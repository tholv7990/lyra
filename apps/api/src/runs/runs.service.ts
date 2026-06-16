import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  fillPrompt,
  STEP_DEFS,
  StepStatus,
  type Provider,
  type Run as RunModel,
  type Step,
  type StepMode,
} from '@lyra/shared';
import { Run, RunDocument } from './run.schema';
import { BaseRepository } from '../common/database/base.repository';
import { KeysService } from '../keys/keys.service';
import { UsersService } from '../users/users.service';
import { PromptsService } from '../prompts/prompts.service';
import { toRun, toState } from './run.views';
import { ProviderRegistry } from './providers/provider.registry';
import type { StepRunOutput } from './providers/step-provider.interface';
import {
  buildSteps,
  assertRunnable,
  beginStep,
  completeStep,
  failStep,
  approveGateAt,
  stopRun,
  resetRun,
  isLocked,
  providerOf,
  StepLockedError,
  RunTransitionError,
  type ProjectInfo,
  type RunState,
} from './run.engine';

// Composable-pipeline run creation input.
export interface PipelineRunInput {
  projectId: string;
  workspaceId: string;
  pipelineId: string;
  pipelineName: string;
  context: { product: string; niche: string; homepageUrl: string };
  steps: {
    name: string;
    promptId: string;
    provider: Provider;
    model: string;
    mode: StepMode;
  }[];
}

// Resolve chaining placeholders in a step's prompt: {input} = the previous
// step's output, {step:Name} = a named earlier step's output. Returns whether
// any placeholder was used (if so, the caller skips auto-appending context).
function resolveChaining(
  prompt: string,
  steps: Step[],
  index: number,
): { prompt: string; used: boolean } {
  let used = false;
  let text = prompt;
  if (text.includes('{input}')) {
    used = true;
    const prev = [...steps].slice(0, index).reverse().find((s) => s.result);
    text = text.split('{input}').join(prev?.result ?? '');
  }
  text = text.replace(/\{step:([^}]+)\}/g, (_m, nm: string) => {
    used = true;
    const match = steps.find(
      (s) => (s.name ?? '').toLowerCase() === nm.trim().toLowerCase() && s.result,
    );
    return match?.result ?? '';
  });
  return { prompt: text, used };
}

@Injectable()
export class RunsService extends BaseRepository<Run> {
  constructor(
    @InjectModel(Run.name) model: Model<Run>,
    private readonly keys: KeysService,
    private readonly users: UsersService,
    private readonly registry: ProviderRegistry,
    private readonly prompts: PromptsService,
  ) {
    super(model);
  }

  // Create a run from a composable pipeline: snapshot each step (prompt content
  // resolved from the library + project placeholders filled, provider/model/mode
  // copied) so later edits to the pipeline never affect this run.
  async createForPipeline(input: PipelineRunInput, actorId: string) {
    const steps: Partial<Step>[] = [];
    for (let i = 0; i < input.steps.length; i++) {
      const ps = input.steps[i];
      const prompt = await this.prompts.findActiveById(ps.promptId);
      steps.push({
        index: i,
        name: ps.name,
        promptId: ps.promptId,
        provider: ps.provider,
        model: ps.model,
        mode: ps.mode,
        status: StepStatus.Idle,
        prompt: fillPrompt(prompt?.content ?? '', {
          product: input.context.product,
          niche: input.context.niche,
          homepage: input.context.homepageUrl,
        }),
      });
    }
    return this.create({
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      pipelineId: input.pipelineId,
      pipelineName: input.pipelineName,
      context: input.context,
      createdBy: actorId,
      updatedBy: actorId,
      status: 'idle',
      currentStep: 0,
      steps: steps as unknown as RunDocument['steps'],
    });
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

  // Map pure-engine transition errors to HTTP 400.
  private guard(fn: () => void) {
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

  // Dispatch one step to its provider. The decrypted key is resolved here (BYOK,
  // per-workspace) and prior results are passed as context.
  private async executeStep(
    doc: RunDocument,
    state: RunState,
    index: number,
  ): Promise<StepRunOutput> {
    const step = state.steps[index];
    const provider = providerOf(step);
    const apiKey = (await this.keys.getDecrypted(doc.workspaceId, provider)) ?? '';

    // Chaining: inject {input}/{step:Name} if present, else auto-append prior
    // results as context.
    const { prompt, used } = resolveChaining(step.prompt, state.steps, index);
    const stepForRun = used ? { ...step, prompt } : step;
    const priorResults = used
      ? []
      : state.steps
          .filter((s) => s.index < index && s.result)
          .map((s) => ({
            key: s.key,
            title:
              s.name ?? STEP_DEFS[s.index]?.title ?? s.key ?? `Step ${s.index + 1}`,
            result: s.result as string,
          }));
    return this.registry.get(provider).execute({ step: stepForRun, apiKey, priorResults });
  }

  // Run one step: validate, mark running, call the provider, then complete or
  // record the failure. A provider error is persisted on the step (run -> error)
  // and returned, so the workbench can show it.
  async runStep(doc: RunDocument, index: number, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    this.guard(() => assertRunnable(state, index, present));
    beginStep(state, index);
    try {
      completeStep(state, index, await this.executeStep(doc, state, index));
    } catch (err) {
      failStep(state, index, errMessage(err));
    }
    return this.persist(doc, state, actorId);
  }

  // Run consecutive steps until a gate pauses, a step is locked (missing key),
  // a step errors, or the run completes.
  async runAll(doc: RunDocument, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    while (state.status === 'idle' && state.currentStep < state.steps.length) {
      const index = state.currentStep;
      if (isLocked(state.steps[index], present)) break;
      beginStep(state, index);
      try {
        completeStep(state, index, await this.executeStep(doc, state, index));
      } catch (err) {
        failStep(state, index, errMessage(err));
        break;
      }
    }
    return this.persist(doc, state, actorId);
  }

  approveGate(doc: RunDocument, index: number, actorId: string) {
    const state = toState(doc);
    this.guard(() => approveGateAt(state, index));
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

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Step failed';
}
