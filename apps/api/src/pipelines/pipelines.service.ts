import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  type Pipeline as PipelineModel,
  type PipelineStepInput,
  type PipelineVariableInput,
} from '@lyra/shared';
import { Pipeline } from './pipeline.schema';
import type { PipelineDocument } from './pipeline.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toPipeline, pipelineActorIds } from './pipeline.views';

@Injectable()
export class PipelinesService extends BaseRepository<Pipeline> {
  constructor(
    @InjectModel(Pipeline.name) model: Model<Pipeline>,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  findActiveById(id: string) {
    return this.findById(id);
  }

  async toView(p: PipelineDocument): Promise<PipelineModel> {
    const refs = await this.users.refMap(pipelineActorIds(p));
    return toPipeline(p, refs);
  }

  async toViews(ps: PipelineDocument[]): Promise<PipelineModel[]> {
    const refs = await this.users.refMap(ps.flatMap(pipelineActorIds));
    return ps.map((p) => toPipeline(p, refs));
  }

  listForWorkspace(workspaceId: string) {
    return this.find({ workspaceId }, { sort: { createdAt: -1 } });
  }

  // Assign each step a stable id. Models are refreshed live from the provider,
  // so we only require a non-empty model id (not a static-catalog match) — the
  // step picker offers known ids and the provider rejects a bad one at run time.
  normalizeSteps(steps: PipelineStepInput[] = []) {
    return steps.map((s) => {
      if (!s.model?.trim()) {
        throw new BadRequestException(`Step "${s.name}" needs a model.`);
      }
      return {
        id: s.id || randomUUID(),
        name: s.name,
        promptId: s.promptId,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
      };
    });
  }

  // Normalize pipeline variable definitions: trim keys, drop blanks, dedupe by
  // key (first wins). Keys are the {token} names referenced in step prompts.
  normalizeVariables(variables: PipelineVariableInput[] = []) {
    const seen = new Set<string>();
    const out: { key: string; label?: string; default?: string }[] = [];
    for (const v of variables) {
      const key = v.key?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: v.label?.trim() || undefined, default: v.default ?? undefined });
    }
    return out;
  }
}
