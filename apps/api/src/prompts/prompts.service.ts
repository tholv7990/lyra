import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PromptStatus,
  StepKey,
  tagKey,
  type Prompt as PromptModel,
  type TagCount,
} from '@lyra/shared';
import { Prompt } from './prompt.schema';
import type { PromptDocument } from './prompt.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toPrompt, promptActorIds } from './prompt.views';

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

  // Prompts a member may see: every public prompt in the workspace, plus all of
  // their own (including drafts). Optionally narrowed to one step type.
  listForMember(
    workspaceId: string,
    userId: string,
    type?: StepKey,
  ) {
    const filter: Record<string, unknown> = {
      workspaceId,
      $or: [{ status: PromptStatus.Public }, { createdBy: userId }],
    };
    if (type) filter.type = type;
    return this.find(filter, { sort: { updatedAt: -1, createdAt: -1 } });
  }

  // The distinct tag vocabulary across prompts the member can see, with usage
  // counts. Dedup is case-insensitive (first-seen casing wins for display).
  // Sorted by count desc, then alphabetically. Drives the picker on the web.
  async tagVocabulary(workspaceId: string, userId: string): Promise<TagCount[]> {
    const prompts = await this.listForMember(workspaceId, userId);
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
