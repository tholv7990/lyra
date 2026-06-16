import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PromptStatus,
  StepKey,
  type Prompt as PromptModel,
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
}
