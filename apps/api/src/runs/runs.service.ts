import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Run, RunDocument } from './run.schema';
import { BaseRepository } from '../common/database/base.repository';
import { KeysService } from '../keys/keys.service';
import { toState } from './run.views';
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
  ) {
    super(model);
  }

  createForProject(
    projectId: string,
    workspaceId: string,
    createdBy: string,
    project: ProjectInfo,
  ) {
    return this.create({
      projectId,
      workspaceId,
      createdBy,
      status: 'idle',
      currentStep: 0,
      steps: buildSteps(project),
    });
  }

  listForProject(projectId: string) {
    return this.find({ projectId }, { sort: { createdAt: -1 } });
  }

  private async keysPresent(workspaceId: string): Promise<Set<string>> {
    const keys = await this.keys.list(workspaceId);
    return new Set(keys.map((k) => k.provider));
  }

  private async persist(doc: RunDocument, state: RunState) {
    doc.status = state.status;
    doc.currentStep = state.currentStep;
    doc.steps = state.steps as unknown as RunDocument['steps'];
    return doc.save();
  }

  // Wraps engine transitions: maps domain errors to HTTP 400.
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

  async runStep(doc: RunDocument, index: number) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    this.mutate(state, () => runStepAt(state, index, present));
    return this.persist(doc, state);
  }

  async runAll(doc: RunDocument) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    this.mutate(state, () => runAllEngine(state, present));
    return this.persist(doc, state);
  }

  approveGate(doc: RunDocument, index: number) {
    const state = toState(doc);
    this.mutate(state, () => approveGateAt(state, index));
    return this.persist(doc, state);
  }

  stop(doc: RunDocument) {
    const state = toState(doc);
    stopRun(state);
    return this.persist(doc, state);
  }

  reset(doc: RunDocument) {
    const state = toState(doc);
    resetRun(state);
    return this.persist(doc, state);
  }

  updatePrompt(doc: RunDocument, index: number, prompt: string) {
    const step = doc.steps[index];
    if (!step) throw new BadRequestException('No such step');
    step.prompt = prompt;
    return doc.save();
  }
}
