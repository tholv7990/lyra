import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  Provider,
  type Pipeline as PipelineModel,
  type PipelineStepInput,
  type PipelineVariableInput,
  type PromptMedia,
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

  // How many active pipelines have a step bound to this prompt (for the
  // delete-a-prompt warning — those steps would be left empty).
  countUsingPrompt(workspaceId: string, promptId: string): Promise<number> {
    return this.count({ workspaceId, 'steps.promptId': promptId });
  }

  // Assign each step a stable id. Models are refreshed live from the provider,
  // so we only require a non-empty model id (not a static-catalog match) — the
  // step picker offers known ids and the provider rejects a bad one at run time.
  normalizeSteps(steps: PipelineStepInput[] = []) {
    return steps.map((s) => {
      if (!s.model?.trim()) {
        throw new BadRequestException(`Step "${s.name}" needs a model.`);
      }
      const fanOut = s.fanOut?.over?.trim()
        ? { over: s.fanOut.over.trim(), itemVar: s.fanOut.itemVar?.trim() || undefined }
        : undefined;
      const condition = s.condition?.variable?.trim()
        ? {
            variable: s.condition.variable.trim(),
            op: s.condition.op,
            value: s.condition.value?.trim() || undefined,
          }
        : undefined;
      return {
        id: s.id || randomUUID(),
        name: s.name,
        promptId: s.promptId,
        // Preserve the per-step override so builder saves don't drop it.
        promptOverride: s.promptOverride?.trim() || undefined,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        fanOut,
        condition,
        kind: s.kind,
        action: s.action,
        // Preserve the per-step QA toggle across builder saves.
        review: s.review,
        // Preserve attached media across builder saves.
        media: s.media,
      };
    });
  }

  // Promote a run-time step config to a pipeline step: sets promptOverride,
  // provider, model, and/or media on the matching step so future runs use this
  // config instead of the pipeline defaults.
  // Tenant-fenced: the pipeline must belong to the given workspaceId.
  async setStepOverride(
    workspaceId: string,
    pipelineId: string,
    stepId: string,
    cfg: { promptOverride?: string; provider?: Provider; model?: string; media?: PromptMedia[] },
    actorId: string,
  ): Promise<PipelineModel> {
    // Enforce the same bound the builder DTO applies (@MaxLength 8000) — the promote
    // path comes from the run-step prompt, which isn't length-capped at its source.
    if (cfg.promptOverride !== undefined && cfg.promptOverride.length > 8000) {
      throw new BadRequestException('Prompt is too long to save to the pipeline (max 8000 characters).');
    }
    const pipeline = await this.findOne({ _id: pipelineId, workspaceId });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    const step = pipeline.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new BadRequestException(
        'That pipeline step no longer exists — it may have been removed or changed.',
      );
    }
    if (cfg.promptOverride !== undefined) step.promptOverride = cfg.promptOverride;
    if (cfg.provider) step.provider = cfg.provider;
    if (cfg.model?.trim()) step.model = cfg.model;
    if (cfg.media !== undefined) step.media = cfg.media;
    pipeline.updatedBy = actorId;
    pipeline.markModified('steps');
    await pipeline.save();
    return this.toView(pipeline);
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
