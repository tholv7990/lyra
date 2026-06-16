import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { isModelAllowed, type Pipeline as PipelineModel, type PipelineStepInput } from '@lyra/shared';
import { Pipeline } from './pipeline.schema';
import type { PipelineDocument } from './pipeline.schema';
import { ProjectPipeline } from './project-pipeline.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toPipeline, pipelineActorIds } from './pipeline.views';

@Injectable()
export class PipelinesService extends BaseRepository<Pipeline> {
  constructor(
    @InjectModel(Pipeline.name) model: Model<Pipeline>,
    @InjectModel(ProjectPipeline.name)
    private readonly links: Model<ProjectPipeline>,
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

  // Assign each step a stable id and validate its model against the catalog.
  normalizeSteps(steps: PipelineStepInput[] = []) {
    return steps.map((s) => {
      if (!isModelAllowed(s.provider, s.model)) {
        throw new BadRequestException(`Unknown model "${s.model}" for ${s.provider}`);
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

  // ===== Project assignment (many-to-many link) =====
  async assign(
    workspaceId: string,
    projectId: string,
    pipelineId: string,
    actorId: string,
  ) {
    await this.links
      .findOneAndUpdate(
        { projectId, pipelineId },
        {
          $set: { active: true, updatedBy: actorId },
          $setOnInsert: { workspaceId, projectId, pipelineId, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
  }

  unassign(projectId: string, pipelineId: string, actorId: string) {
    return this.links
      .findOneAndUpdate(
        { projectId, pipelineId, active: { $ne: false } },
        { active: false, updatedBy: actorId },
      )
      .exec();
  }

  // The pipelines assigned to a project (active links → active pipelines).
  async listAssigned(projectId: string): Promise<PipelineDocument[]> {
    const links = await this.links
      .find({ projectId, active: { $ne: false } })
      .exec();
    const ids = links.map((l) => l.pipelineId);
    if (!ids.length) return [];
    return this.find({ _id: { $in: ids } }, { sort: { createdAt: -1 } });
  }
}
