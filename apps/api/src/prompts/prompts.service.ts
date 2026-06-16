import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PromptStatus,
  tagKey,
  type Prompt as PromptModel,
  type TagCount,
} from '@lyra/shared';
import { Prompt } from './prompt.schema';
import type { PromptDocument } from './prompt.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toPrompt, promptActorIds } from './prompt.views';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PromptListOptions {
  status?: PromptStatus;
  tag?: string;
  q?: string;
  page: number;
  limit: number;
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

  // Paginated + filtered list (by status, a single tag, and a title query).
  async listPaged(
    workspaceId: string,
    userId: string,
    opts: PromptListOptions,
  ): Promise<{ items: PromptDocument[]; total: number }> {
    const filter = this.visibleFilter(workspaceId, userId);
    if (opts.status) filter.status = opts.status;
    if (opts.tag) filter.tags = opts.tag;
    if (opts.q) filter.title = { $regex: escapeRegex(opts.q), $options: 'i' };
    const total = await this.count(filter);
    const items = await this.find(filter, {
      sort: { updatedAt: -1, createdAt: -1 },
      skip: (opts.page - 1) * opts.limit,
      limit: opts.limit,
    });
    return { items, total };
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
}
