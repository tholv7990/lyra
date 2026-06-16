import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Run as RunModel } from '@lyra/shared';
import { Run, RunDocument } from './run.schema';
import { BaseRepository } from '../common/database/base.repository';
import { KeysService } from '../keys/keys.service';
import { UsersService } from '../users/users.service';
import { toRun, toState } from './run.views';
import {
  buildSteps,
  runStepAt,
  approveGateAt,
  runAll as runAllEngine,
  stopRun,
  resetRun,
  StepLockedError,
  RunTransitionError,
  type ProjectInfo,
  type RunState,
} from './run.engine';

@Injectable()
export class RunsService extends BaseRepository<Run> {
  constructor(
    @InjectModel(Run.name) model: Model<Run>,
    private readonly keys: KeysService,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  createForProject(
    projectId: string,
    workspaceId: string,
    actorId: string,
    project: ProjectInfo,
  ) {
    return this.create({
      projectId,
      workspaceId,
      createdBy: actorId,
      updatedBy: actorId,
      status: 'idle',
      currentStep: 0,
      steps: buildSteps(project),
    });
  }

  listForProject(projectId: string) {
    return this.find({ projectId }, { sort: { createdAt: -1 } });
  }

  async toView(doc: RunDocument): Promise<RunModel> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toRun(doc, refs);
  }

  async toViews(docs: RunDocument[]): Promise<RunModel[]> {
    const refs = await this.users.refMap(
      docs.flatMap((d) => [d.createdBy, d.updatedBy]),
    );
    return docs.map((d) => toRun(d, refs));
  }

  private async keysPresent(workspaceId: string): Promise<Set<string>> {
    const keys = await this.keys.list(workspaceId);
    return new Set(keys.map((k) => k.provider));
  }

  private async persist(
    doc: RunDocument,
    state: RunState,
    actorId: string,
  ): Promise<RunModel> {
    doc.status = state.status;
    doc.currentStep = state.currentStep;
    doc.steps = state.steps as unknown as RunDocument['steps'];
    doc.updatedBy = actorId;
    await doc.save();
    return this.toView(doc);
  }

  private mutate(state: RunState, fn: () => void) {
    try {
      fn();
    } catch (err) {
      if (err instanceof StepLockedError) {
        throw new BadRequestException(
          `This step needs the "${err.provider}" provider key — add it in Settings.`,
        );
      }
      if (err instanceof RunTransitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  async runStep(doc: RunDocument, index: number, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    this.mutate(state, () => runStepAt(state, index, present));
    return this.persist(doc, state, actorId);
  }

  async runAll(doc: RunDocument, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    this.mutate(state, () => runAllEngine(state, present));
    return this.persist(doc, state, actorId);
  }

  approveGate(doc: RunDocument, index: number, actorId: string) {
    const state = toState(doc);
    this.mutate(state, () => approveGateAt(state, index));
    return this.persist(doc, state, actorId);
  }

  stop(doc: RunDocument, actorId: string) {
    const state = toState(doc);
    stopRun(state);
    return this.persist(doc, state, actorId);
  }

  reset(doc: RunDocument, actorId: string) {
    const state = toState(doc);
    resetRun(state);
    return this.persist(doc, state, actorId);
  }

  async updatePrompt(
    doc: RunDocument,
    index: number,
    prompt: string,
    actorId: string,
  ) {
    const step = doc.steps[index];
    if (!step) throw new BadRequestException('No such step');
    step.prompt = prompt;
    doc.updatedBy = actorId;
    await doc.save();
    return this.toView(doc);
  }
}
