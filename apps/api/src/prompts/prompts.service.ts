import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Provider,
  PromptStatus,
  PromptType,
  tagKey,
  type ProviderCount,
  type PromptAuthorCount,
  type PromptTypeCount,
  type Prompt as PromptModel,
  type SaveResultDto,
  type TagCount,
  type UpdateResultDto,
} from '@lyra/shared';
import { Prompt, PromptResultItem } from './prompt.schema';
import type { PromptDocument } from './prompt.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toPrompt, promptActorIds } from './prompt.views';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PromptListOptions {
  statuses?: PromptStatus[];
  tags?: string[];
  types?: PromptType[];
  createdBy?: string[];
  providers?: Provider[];
  q?: string;
  sort?: 'updated' | 'az';
  page: number;
  limit: number;
}

export function buildPromptListFilter(
  workspaceId: string,
  userId: string,
  opts: Pick<
    PromptListOptions,
    'statuses' | 'tags' | 'types' | 'createdBy' | 'providers' | 'q'
  >,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    workspaceId,
    $or: [{ status: PromptStatus.Public }, { createdBy: userId }],
  };
  if (opts.statuses?.length) filter.status = { $in: opts.statuses };
  if (opts.tags?.length) {
    filter.tags = { $in: opts.tags.map((tag) => new RegExp(`^${escapeRegex(tag)}$`, 'i')) };
  }
  // Type filter mirrors tags: any-selected (OR within group), case-insensitive,
  // ANDed with the other groups.
  if (opts.types?.length) {
    filter.type = { $in: opts.types.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) };
  }
  if (opts.createdBy?.length) filter.createdBy = { $in: opts.createdBy };
  if (opts.providers?.length) filter.provider = { $in: opts.providers };
  if (opts.q) filter.title = { $regex: escapeRegex(opts.q), $options: 'i' };
  return filter;
}

@Injectable()
export class PromptsService extends BaseRepository<Prompt> {
  constructor(
    @InjectModel(Prompt.name) model: Model<Prompt>,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  // Base findById already excludes soft-deleted; alias kept for guard clarity.
  findActiveById(id: string) {
    return this.findById(id);
  }

  async toView(p: PromptDocument): Promise<PromptModel> {
    const refs = await this.users.refMap(promptActorIds(p));
    return toPrompt(p, refs);
  }

  // ===== Saved results (answer children) =====
  // Subdocs carry an _id at runtime the class type doesn't declare.
  private resultsWithId(prompt: PromptDocument) {
    return prompt.results as (PromptResultItem & { _id: { toString(): string } })[];
  }

  // Save an answer under the prompt. Any member who can view the prompt may save
  // (the chat "Save" action); `createdBy` records who did. The snapshot falls
  // back to the prompt's current wording when the caller doesn't supply one.
  async addResult(
    prompt: PromptDocument,
    userId: string,
    dto: SaveResultDto,
  ): Promise<PromptModel> {
    prompt.results.push({
      output: dto.output,
      provider: dto.provider,
      model: dto.model,
      promptSnapshot: dto.promptSnapshot?.trim() || prompt.content,
      sourceConversationId: dto.sourceConversationId,
      rating: dto.rating,
      note: dto.note,
      createdBy: userId,
      savedAt: new Date(),
    });
    await prompt.save();
    return this.toView(prompt);
  }

  // Remove a saved result. Allowed for the result's author or the prompt owner.
  async removeResult(
    prompt: PromptDocument,
    userId: string,
    resultId: string,
  ): Promise<PromptModel> {
    const results = this.resultsWithId(prompt);
    const idx = results.findIndex((r) => r._id.toString() === resultId);
    if (idx === -1) throw new NotFoundException('Result not found');
    if (results[idx].createdBy !== userId && prompt.createdBy !== userId) {
      throw new ForbiddenException('Cannot remove this result');
    }
    prompt.results.splice(idx, 1);
    await prompt.save();
    return this.toView(prompt);
  }

  // Update a result's curation metadata (rating / note). Author or prompt owner.
  async updateResult(
    prompt: PromptDocument,
    userId: string,
    resultId: string,
    dto: UpdateResultDto,
  ): Promise<PromptModel> {
    const result = this.resultsWithId(prompt).find(
      (r) => r._id.toString() === resultId,
    );
    if (!result) throw new NotFoundException('Result not found');
    if (result.createdBy !== userId && prompt.createdBy !== userId) {
      throw new ForbiddenException('Cannot modify this result');
    }
    if (dto.rating !== undefined) result.rating = dto.rating;
    if (dto.note !== undefined) result.note = dto.note;
    await prompt.save();
    return this.toView(prompt);
  }

  async toViews(ps: PromptDocument[]): Promise<PromptModel[]> {
    const refs = await this.users.refMap(ps.flatMap(promptActorIds));
    return ps.map((p) => toPrompt(p, refs));
  }

  // Base visibility: every public prompt in the workspace, plus the caller's own
  // (including drafts).
  private visibleFilter(workspaceId: string, userId: string): Record<string, unknown> {
    return {
      workspaceId,
      $or: [{ status: PromptStatus.Public }, { createdBy: userId }],
    };
  }

  listVisible(workspaceId: string, userId: string) {
    return this.find(this.visibleFilter(workspaceId, userId), {
      sort: { updatedAt: -1, createdAt: -1 },
    });
  }

  // Public prompts only (the set pipelines bind) — newest first, capped. Used by
  // the AI pipeline generator to ground its design in real, usable prompts.
  listPublic(workspaceId: string, limit = 60) {
    return this.find(
      { workspaceId, status: PromptStatus.Public },
      { sort: { updatedAt: -1 }, limit },
    );
  }

  // Paginated + filtered list. Multi-select filters use OR within each group
  // and AND between groups.
  async listPaged(
    workspaceId: string,
    userId: string,
    opts: PromptListOptions,
  ): Promise<{ items: PromptDocument[]; total: number }> {
    const filter = buildPromptListFilter(workspaceId, userId, opts);
    // az = title asc; default = recently-updated.
    const sort =
      opts.sort === 'az'
        ? { title: 1 as const }
        : { updatedAt: -1 as const, createdAt: -1 as const };
    const total = await this.count(filter);
    const items = await this.find(filter, {
      sort,
      skip: (opts.page - 1) * opts.limit,
      limit: opts.limit,
    });
    return { items, total };
  }

  // The distinct output-type vocabulary across prompts the member can see, with
  // counts — drives the Prompts page type-pill row. Returns all four types in
  // canonical order (a 0-count type still renders as an empty pill is the web's
  // call; here we report every type's true count).
  async typeVocabulary(workspaceId: string, userId: string): Promise<PromptTypeCount[]> {
    const prompts = await this.listVisible(workspaceId, userId);
    const counts = new Map<PromptType, number>();
    for (const p of prompts) {
      const type = (p.type ?? PromptType.Text) as PromptType;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return Object.values(PromptType).map((type) => ({ type, count: counts.get(type) ?? 0 }));
  }

  // The distinct tag vocabulary across prompts the member can see, with usage
  // counts. Dedup is case-insensitive (first-seen casing wins for display).
  // Sorted by count desc, then alphabetically. Drives the tag filter on the web.
  async tagVocabulary(workspaceId: string, userId: string): Promise<TagCount[]> {
    const prompts = await this.listVisible(workspaceId, userId);
    const byKey = new Map<string, TagCount>();
    for (const p of prompts) {
      for (const raw of p.tags ?? []) {
        const key = tagKey(raw);
        if (!key) continue;
        const existing = byKey.get(key);
        if (existing) existing.count += 1;
        else byKey.set(key, { value: raw, count: 1 });
      }
    }
    return [...byKey.values()].sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value),
    );
  }

  // The distinct provider vocabulary across prompts the member can see, with
  // usage counts (sorted by count desc, then provider). Derived from the full
  // visible library — NOT a paginated/filtered page — so the Prompts provider
  // filter stays stable as other filters are applied.
  async providerVocabulary(workspaceId: string, userId: string): Promise<ProviderCount[]> {
    const prompts = await this.listVisible(workspaceId, userId);
    const counts = new Map<Provider, number>();
    for (const p of prompts) {
      if (!p.provider) continue;
      const provider = p.provider as Provider;
      counts.set(provider, (counts.get(provider) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
  }

  async authorVocabulary(workspaceId: string, userId: string): Promise<PromptAuthorCount[]> {
    const prompts = await this.listVisible(workspaceId, userId);
    const refs = await this.users.refMap([...new Set(prompts.map((p) => p.createdBy))]);
    const byId = new Map<string, PromptAuthorCount>();
    for (const p of prompts) {
      const existing = byId.get(p.createdBy);
      if (existing) existing.count += 1;
      else {
        const ref = refs.get(p.createdBy) ?? { id: p.createdBy, name: 'Unknown' };
        byId.set(p.createdBy, { ...ref, count: 1 });
      }
    }
    return [...byId.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }
}
