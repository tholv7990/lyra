import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  fillPrompt,
  resolveStepRefs,
  STEP_DEFS,
  StepStatus,
  type Provider,
  type Run as RunModel,
  type Step,
  type StepCondition,
  type StepMode,
} from '@lyra/shared';
import { Run, RunDocument } from './run.schema';
import { BaseRepository } from '../common/database/base.repository';
import { KeysService } from '../keys/keys.service';
import { UsersService } from '../users/users.service';
import { PromptsService } from '../prompts/prompts.service';
import { AssetsService } from '../assets/assets.service';
import { toRun, toState } from './run.views';
import { ProviderRegistry } from './providers/provider.registry';
import type { StepRunOutput } from './providers/step-provider.interface';
import {
  assertRunnable,
  assertStepPosition,
  beginStep,
  completeStep,
  failStep,
  skipStep,
  shouldSkip,
  approveGateAt,
  stopRun,
  resetRun,
  isLocked,
  providerOf,
  StepLockedError,
  RunTransitionError,
  type RunState,
} from './run.engine';

// Composable-pipeline run creation input. projectId is omitted for a builder
// "test run" (no project — projectVariables is then empty).
export interface PipelineRunInput {
  projectId?: string;
  workspaceId: string;
  pipelineId: string;
  pipelineName: string;
  // The project's key→value variables (token-keyed); empty for a test run.
  projectVariables: Record<string, string>;
  // The pipeline note — the first step's default input (also exposed as {note}).
  note?: string;
  // Custom variable values entered at run start (already merged with defaults).
  variables?: Record<string, string>;
  // Named lists a fan-out step maps over (e.g. the source images to brand).
  collections?: Record<string, string[]>;
  steps: {
    name: string;
    promptId: string;
    provider: Provider;
    model: string;
    mode: StepMode;
    fanOut?: { over: string; itemVar?: string };
    condition?: StepCondition;
  }[];
}

// Fan-out execution limits — how many items run concurrently, and per-item retries.
const FANOUT_CONCURRENCY = 4;
const FANOUT_RETRIES = 2;

@Injectable()
export class RunsService extends BaseRepository<Run> {
  constructor(
    @InjectModel(Run.name) model: Model<Run>,
    private readonly keys: KeysService,
    private readonly users: UsersService,
    private readonly registry: ProviderRegistry,
    private readonly prompts: PromptsService,
    private readonly assets: AssetsService,
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
        fanOut: ps.fanOut,
        condition: ps.condition,
        status: StepStatus.Idle,
        // Store the raw template — project/custom/system vars and {input}/{step:Name}
        // resolve at run time from the run's variable snapshot + prior outputs.
        prompt: prompt?.content ?? '',
      });
    }
    // Variable snapshot: the project's variables (token-keyed) + system {note}/
    // {date} + pipeline custom values (which override). Frozen here so later
    // pipeline/project edits don't leak in.
    const variables: Record<string, string> = {
      ...input.projectVariables,
      note: input.note ?? '',
      date: new Date().toISOString().slice(0, 10),
      ...(input.variables ?? {}),
    };
    return this.create({
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      pipelineId: input.pipelineId,
      pipelineName: input.pipelineName,
      context: { note: input.note ?? '' },
      variables,
      collections: input.collections ?? {},
      createdBy: actorId,
      updatedBy: actorId,
      status: 'idle',
      currentStep: 0,
      steps: steps as unknown as RunDocument['steps'],
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

    // Fan-out step: map the prompt over a run collection (parallel) instead of a
    // single call.
    if (step.fanOut) return this.executeFanOut(doc, state, index, provider, apiKey);

    // Resolve the prompt at run time: first variables ({product}/{tone}/{date}…)
    // from the run snapshot, then chaining ({input}/{step:Name}). When a chaining
    // placeholder is used we skip auto-appending prior context.
    const filled = fillPrompt(step.prompt, doc.variables ?? {});
    const { prompt, used } = resolveStepRefs(filled, state.steps, index);
    const stepForRun = { ...step, prompt };
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

  // Fan-out a step over a run collection: one (capped-parallel) provider call per
  // item, the item filling {item}/{input}. N is arbitrary. Partial failure is
  // tolerated — the step completes with the successful outputs (assets merged);
  // it only errors if EVERY item fails.
  private async executeFanOut(
    doc: RunDocument,
    state: RunState,
    index: number,
    provider: Provider,
    apiKey: string,
  ): Promise<StepRunOutput> {
    const step = state.steps[index];
    const cfg = step.fanOut as { over: string; itemVar?: string };
    const itemVar = cfg.itemVar?.trim() || 'item';
    const items = doc.collections?.[cfg.over] ?? [];
    if (items.length === 0) {
      return { result: `[fan-out] collection "${cfg.over}" is empty — nothing to map.`, assets: [], usage: { tokens: 0 } };
    }
    const impl = this.registry.get(provider);
    const runItem = (item: string): Promise<StepRunOutput> => {
      const filled = fillPrompt(step.prompt, { ...(doc.variables ?? {}), [itemVar]: item });
      // For a fan-out item, {input} is the item itself; {step:Name} still resolves.
      const withInput = filled.split('{input}').join(item);
      const { prompt } = resolveStepRefs(withInput, state.steps, index);
      return impl.execute({ step: { ...step, prompt }, apiKey, priorResults: [] });
    };

    const settled = await mapPool(items, FANOUT_CONCURRENCY, (item) =>
      withRetry(() => runItem(item), FANOUT_RETRIES),
    );
    const ok = settled.filter((s): s is { ok: true; value: StepRunOutput } => s.ok);
    const failed = settled.filter((s): s is { ok: false; error: string } => !s.ok);
    if (ok.length === 0) {
      throw new Error(`All ${items.length} fan-out items failed (e.g. ${failed[0]?.error})`);
    }
    const assets = ok.flatMap((s) => s.value.assets ?? []);
    const tokens = ok.reduce((n, s) => n + (s.value.usage?.tokens ?? 0), 0);
    const body = ok.map((s) => s.value.result).join('\n---\n');
    const head = failed.length
      ? `[fan-out ${ok.length}/${items.length} ok · ${failed.length} failed]\n`
      : `[fan-out ${ok.length}/${items.length}]\n`;
    return { result: head + body, assets, usage: { tokens } };
  }

  // Run one step: validate, mark running, call the provider, then complete or
  // record the failure. A provider error is persisted on the step (run -> error)
  // and returned, so the workbench can show it.
  async runStep(doc: RunDocument, index: number, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    // A step whose guard condition fails is skipped — no provider call, no key.
    if (state.steps[index] && shouldSkip(state.steps[index], doc.variables ?? {})) {
      this.guard(() => assertStepPosition(state, index));
      skipStep(state, index);
      return this.persist(doc, state, actorId);
    }
    this.guard(() => assertRunnable(state, index, present));
    beginStep(state, index);
    try {
      const output = await this.executeStep(doc, state, index);
      completeStep(state, index, output);
      await this.saveAssets(doc, state, index, output, actorId);
    } catch (err) {
      failStep(state, index, errMessage(err));
    }
    return this.persist(doc, state, actorId);
  }

  // Persist any media a step produced as Asset docs and stamp their ids onto the
  // step (so the run carries `assetIds`; the bytes live behind each Asset.url).
  private async saveAssets(
    doc: RunDocument,
    state: RunState,
    index: number,
    output: StepRunOutput,
    actorId: string,
  ): Promise<void> {
    if (!output.assets?.length) return;
    const ids = await this.assets.createForStep(
      {
        workspaceId: doc.workspaceId,
        runId: doc._id.toString(),
        stepIndex: index,
        actorId,
      },
      output.assets,
    );
    state.steps[index].assetIds = ids;
  }

  // Run consecutive steps until a gate pauses, a step is locked (missing key),
  // a step errors, or the run completes.
  async runAll(doc: RunDocument, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    while (state.status === 'idle' && state.currentStep < state.steps.length) {
      const index = state.currentStep;
      // Skip a step whose guard condition fails, then continue with the next.
      if (shouldSkip(state.steps[index], doc.variables ?? {})) {
        skipStep(state, index);
        continue;
      }
      if (isLocked(state.steps[index], present)) break;
      beginStep(state, index);
      try {
        const output = await this.executeStep(doc, state, index);
        completeStep(state, index, output);
        await this.saveAssets(doc, state, index, output, actorId);
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

// Run `fn` over `items` with at most `cap` in flight at once; preserves order.
async function mapPool<T, R>(
  items: T[],
  cap: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(cap, items.length) }, worker));
  return out;
}

type Settled<R> = { ok: true; value: R } | { ok: false; error: string };

// Try `fn` up to (1 + retries) times; never throws — returns a settled result.
async function withRetry<R>(fn: () => Promise<R>, retries: number): Promise<Settled<R>> {
  let error = 'failed';
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed';
    }
  }
  return { ok: false, error };
}
