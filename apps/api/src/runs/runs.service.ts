import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  fillPrompt,
  isActionStep,
  keyProviderFor,
  providerNeedsKey,
  fallbackChain,
  defaultModel,
  resolveStepRefs,
  selectPriorContext,
  DEFAULT_RUN_CONTEXT_TOKENS,
  STEP_DEFS,
  StepStatus,
  Provider,
  ImageOp,
  imageOpPrompt,
  IMAGE_OP_PRESETS,
  StepKind,
  type ActionStep,
  type Run as RunModel,
  type Step,
  type StepCondition,
  type StepMode,
} from '@lyra/shared';
import { Run, RunDocument } from './run.schema';
import { StepResultCache, stepCacheKey } from './step-cache.schema';
import { BaseRepository } from '../common/database/base.repository';
import { KeysService } from '../keys/keys.service';
import { UsersService } from '../users/users.service';
import { PromptsService } from '../prompts/prompts.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { AssetsService } from '../assets/assets.service';
import { FilesService } from '../files/files.service';
import { ProjectsService } from '../projects/projects.service';
import { toRun, toState } from './run.views';
import { ProviderRegistry } from './providers/provider.registry';
import { ActionRegistry } from './providers/action.registry';
import type { LlmAttachment } from './providers/anthropic.client';
import type { StepRunOutput, PriorStepResult, StepInputImage } from './providers/step-provider.interface';
import { gatherInputImages, fetchImagesByUrl } from './providers/image-inputs';
import { isRetryableProviderError } from './providers/retryable';
import { RenderClient } from './providers/render.client';
import { assembleLedger } from './run-ledger';
import type { RunLedger } from './run-ledger';
import {
  assertRunnable,
  assertStepPosition,
  beginStep,
  completeStep,
  gateForReview,
  failStep,
  skipStep,
  shouldSkip,
  submitAsyncStep,
  approveGateAt,
  rejectGateAt,
  stopRun,
  resetRun,
  isLocked,
  providerOf,
  beginDerivedStep,
  completeDerivedStep,
  failDerivedStep,
  StepLockedError,
  RunTransitionError,
  type RunState,
} from './run.engine';

// Composable-pipeline run creation input. projectId is omitted for a builder
// "test run" (no project — projectVariables is then empty).
export interface PipelineRunInput {
  projectId?: string;
  taskId?: string;
  productId?: string;
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
    id: string;
    name: string;
    promptId: string;
    // When set (non-empty), used as the step's prompt instead of the library prompt.
    promptOverride?: string;
    provider: Provider;
    model: string;
    mode: StepMode;
    fanOut?: { over: string; itemVar?: string };
    condition?: StepCondition;
    kind?: StepKind;
    action?: ActionStep;
    review?: boolean;
    media?: import('@lyra/shared').PromptMedia[];
  }[];
}

// Fan-out execution limits — how many items run concurrently, and per-item retries.
const FANOUT_CONCURRENCY = 4;
const FANOUT_RETRIES = 2;

// Visual-capable providers — resolve inputImages for these.
const VISUAL_PROVIDERS = new Set<Provider>([Provider.Image, Provider.Google, Provider.Video]);
// How long a cached step result is reusable. Mongo TTL prunes past expiresAt.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// "Recall, don't append-all": cap the auto-appended prior-step context to a token budget
// (most-recent priors kept). Default ON; RUN_CONTEXT_RECALL=off restores legacy append-all.
const RUN_CONTEXT_RECALL = process.env.RUN_CONTEXT_RECALL !== 'off';
const RUN_CONTEXT_BUDGET = Number(process.env.RUN_CONTEXT_MAX_TOKENS) || DEFAULT_RUN_CONTEXT_TOKENS;
// Max reload-and-retry attempts when an optimistic-concurrency conflict (VersionError) hits a cheap transition.
const COMMIT_MAX_RETRIES = 4;

@Injectable()
export class RunsService extends BaseRepository<Run> {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    @InjectModel(Run.name) model: Model<Run>,
    private readonly keys: KeysService,
    private readonly users: UsersService,
    private readonly registry: ProviderRegistry,
    private readonly prompts: PromptsService,
    private readonly assets: AssetsService,
    private readonly actions: ActionRegistry,
    private readonly projects: ProjectsService,
    @InjectModel(StepResultCache.name) private readonly cache: Model<StepResultCache>,
    private readonly pipelines: PipelinesService,
    private readonly renderClient: RenderClient,
    private readonly files: FilesService,
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
      // Resolve the step's effective prompt: a per-step override wins over the
      // library prompt (promptId lookup). Action steps have neither.
      let prompt: string;
      if (ps.promptOverride && ps.promptOverride.trim()) {
        prompt = ps.promptOverride;
      } else if (ps.promptId) {
        // Action steps carry no promptId — don't look one up (an empty id would
        // throw a Mongoose CastError). Prompt steps always have one.
        prompt = (await this.prompts.findActiveById(ps.promptId))?.content ?? '';
      } else {
        prompt = '';
      }
      steps.push({
        index: i,
        name: ps.name,
        promptId: ps.promptId,
        // Stamp the originating pipeline-step id so "Save to pipeline" can
        // target the exact step even after the pipeline is reordered/edited.
        pipelineStepId: ps.id,
        provider: ps.provider,
        model: ps.model,
        mode: ps.mode,
        fanOut: ps.fanOut,
        condition: ps.condition,
        kind: ps.kind,
        action: ps.action,
        // Post-render QA toggle snapshotted onto the run step (undefined = on).
        review: ps.review,
        // Media files snapshotted onto the run step.
        media: ps.media,
        status: StepStatus.Idle,
        // Store the raw template — project/custom/system vars and {input}/{step:Name}
        // resolve at run time from the run's variable snapshot + prior outputs.
        prompt,
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
      taskId: input.taskId,
      productId: input.productId,
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

  listForTask(taskId: string) {
    return this.find({ taskId }, { sort: { createdAt: -1 } });
  }

  // All of a project's runs (across its tasks) — used by the copilot to summarize
  // project run history.
  listForProject(projectId: string) {
    return this.find({ projectId }, { sort: { createdAt: -1 } });
  }

  listForProduct(productId: string, workspaceId: string) {
    return this.find({ productId, workspaceId, active: { $ne: false } }, { sort: { createdAt: -1 } });
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

  private async reload(doc: RunDocument): Promise<RunDocument> {
    const fresh = await this.model.findById(doc._id).exec();
    if (!fresh) throw new BadRequestException('Run no longer exists.');
    return fresh as RunDocument;
  }

  // Apply a cheap, PURE transition with reload-retry on an optimistic-concurrency
  // conflict. `mutate` must be re-runnable against a freshly-loaded state (no I/O,
  // no spend) — it is replayed on a reloaded doc when a concurrent writer bumped __v.
  private async commit(
    doc: RunDocument,
    mutate: (s: RunState) => void,
    actorId: string,
  ): Promise<RunModel> {
    let working = doc;
    for (let attempt = 0; ; attempt++) {
      const state = toState(working);
      mutate(state);
      try {
        return await this.persist(working, state, actorId);
      } catch (e) {
        if (isVersionError(e) && attempt < COMMIT_MAX_RETRIES) {
          working = await this.reload(working);
          continue;
        }
        throw e;
      }
    }
  }

  // Expensive transitions do provider I/O before saving, so they cannot be replayed
  // on conflict. On a VersionError, surface a clean 409-style error to the user (no
  // silent clobber); if a step had just submitted an async job, log its jobId so the
  // paid prediction is recoverable.
  private translatePersistError(e: unknown, state: RunState): never {
    if (isVersionError(e)) {
      const submitting = state.steps.find((s) => s.status === StepStatus.Running && (s as { jobId?: string }).jobId);
      if (submitting) this.logger.warn(`orphaned replicate jobId ${(submitting as { jobId?: string }).jobId} (run changed before save)`);
      throw new BadRequestException('This run changed in another session — refresh and try again.');
    }
    throw e;
  }

  // For the poller: a VersionError means a concurrent writer changed the run; drop
  // this update (the next tick re-reads and recovers) rather than clobber.
  private async persistOrDrop(doc: RunDocument, state: RunState, actorId: string): Promise<RunModel> {
    try {
      return await this.persist(doc, state, actorId);
    } catch (e) {
      if (isVersionError(e)) {
        this.logger.warn(`run ${String(doc._id)}: persist dropped on conflict (recovers next tick)`);
        return this.toView(doc);
      }
      throw e;
    }
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

  // Build LlmAttachments from a step's media array (images + PDFs only; capped
  // at 5). Mirrors ConversationsService.buildAttachments. Best-effort: a
  // readBuffer failure silently skips that attachment so a bad/expired file
  // doesn't block the step.
  private async buildStepAttachments(media: import('@lyra/shared').PromptMedia[], workspaceId: string): Promise<LlmAttachment[]> {
    const out: LlmAttachment[] = [];
    for (const m of media.slice(0, 5)) {
      const mime = m.mime ?? '';
      const isImage = mime.startsWith('image/');
      const isPdf = mime === 'application/pdf';
      if (!isImage && !isPdf) continue;
      const id = m.url.split('/').pop();
      if (!id) continue;
      try {
        const buf = await this.files.readBuffer(id, workspaceId);
        out.push({ kind: isImage ? 'image' : 'document', mediaType: mime, dataBase64: buf.toString('base64') });
      } catch {
        // skip unreadable attachments
      }
    }
    return out;
  }

  // Dispatch one step to its provider. The decrypted key is resolved here (BYOK,
  // per-workspace) and prior results are passed as context.
  private async executeStep(
    doc: RunDocument,
    state: RunState,
    index: number,
    bypassCache = false,
  ): Promise<StepRunOutput> {
    const step = state.steps[index];
    const ledger = assembleLedger(state.steps.slice(0, index), doc.variables ?? {});

    // Action steps: dispatched to ActionRegistry without key decryption (invariant 7).
    if (isActionStep(step) && step.action) {
      // Resolve {input}/{step:Name} so the action gets the prior image URL etc.
      const filled = fillPrompt(step.prompt, doc.variables ?? {});
      const { prompt } = resolveStepRefs(filled, state.steps, index);
      step.sentPrompt = prompt;
      const brandKit = doc.projectId ? (await this.projects.brandKit(doc.projectId)) : undefined;
      return this.actions.get(step.action.type).execute({
        action: step.action,
        step: { ...step, prompt },
        projectId: doc.projectId,
        productId: doc.productId,
        workspaceId: doc.workspaceId,
        priorResults: [],
        brandKit,
        ledger,
      });
    }

    // Prompt steps: dispatched to ProviderRegistry with key decryption.
    const provider = providerOf(step);
    // Some providers auth with another's key (image steps use the OpenAI key).
    const apiKey = (await this.keys.getDecrypted(doc.workspaceId, keyProviderFor(provider))) ?? '';

    // Fan-out step: map the prompt over a run collection (parallel) instead of a
    // single call.
    if (step.fanOut) return this.executeFanOut(doc, state, index, provider, apiKey, ledger);

    // Resolve the prompt at run time: first variables ({product}/{tone}/{date}…)
    // from the run snapshot, then chaining ({input}/{step:Name}). When a chaining
    // placeholder is used we skip auto-appending prior context.
    const filled = fillPrompt(step.prompt, doc.variables ?? {});
    const { prompt, used } = resolveStepRefs(filled, state.steps, index);
    // Record the exact prompt sent (shown in step details). Mutating `step`
    // (a reference into `state`) persists when the run state is saved.
    step.sentPrompt = prompt;
    const stepForRun = { ...step, prompt };
    const allPriors = used
      ? []
      : state.steps
          .filter((s) => s.index < index && s.result)
          .map((s) => ({
            key: s.key,
            title:
              s.name ?? STEP_DEFS[s.index]?.title ?? s.key ?? `Step ${s.index + 1}`,
            result: s.result as string,
          }));
    // Recall, don't append-all: keep the most-recent priors within a token budget so
    // long pipelines don't balloon context (the token win). Explicit {step:Name}/{input}
    // chaining already bypasses this (used=true → no auto-append). Flag-gated.
    const priorResults = RUN_CONTEXT_RECALL ? selectPriorContext(allPriors, RUN_CONTEXT_BUDGET) : allPriors;
    if (priorResults.length < allPriors.length) {
      this.logger.log(
        `run ${doc._id.toString()} step ${index}: prior context trimmed ${allPriors.length}→${priorResults.length} (budget ${RUN_CONTEXT_BUDGET} tok)`,
      );
    }
    // Visual steps may take prior steps' images as inputs (edit/compose). Resolve
    // {input}/{step:Name} → prior image assets, fetched to base64 (capped). Pass
    // `filled` (pre-resolveStepRefs) — resolveStepRefs replaces the chaining tokens
    // with prior steps' result TEXT, so `prompt` no longer carries them.
    let inputImages: Awaited<ReturnType<typeof gatherInputImages>> = [];
    if (VISUAL_PROVIDERS.has(provider)) {
      const runAssets = await this.assets.listForRun(doc._id.toString());
      if (step.inputAssetIds?.length) {
        // Image action: operate on the exact source asset(s) — resolve them from
        // THIS run's assets only (server-authoritative; no client-supplied URL).
        const urls = runAssets
          .filter((a) => step.inputAssetIds!.includes(a._id.toString()) && a.type === 'image')
          .map((a) => a.url);
        inputImages = await fetchImagesByUrl(urls);
      } else {
        inputImages = await gatherInputImages(
          filled,
          state.steps,
          index,
          (i) => runAssets.filter((a) => a.stepIndex === i).map((a) => ({ type: a.type, url: a.url })),
        );
      }
    }

    // Build model attachments from step.media (images + PDFs, base64). For prompt
    // steps only — action and fan-out steps don't reach here.
    const attachments: LlmAttachment[] = step.media?.length
      ? await this.buildStepAttachments(step.media, doc.workspaceId)
      : [];

    // Per-step cache: reuse an identical prior execution to avoid re-spending. Only
    // key-requiring providers (skips Crawl); action + fan-out never reach here. Best-effort.
    // The key folds in the auto-appended prior context (when used=false) AND the image
    // inputs AND media, so an upstream result change, a different chained image, or a
    // media change always misses.
    const cacheable = providerNeedsKey(provider);
    const context =
      (used ? '' : priorResults.map((r) => r.result).join(' ')) +
      (inputImages.length ? ' img:' + inputImages.map((i) => i.url).join(',') : '') +
      (attachments.length ? ' media:' + (step.media ?? []).map((m) => m.url).join(',') : '');
    const cacheKey = cacheable
      ? stepCacheKey({ workspaceId: doc.workspaceId, provider, model: stepForRun.model, prompt, context })
      : '';
    if (cacheable && !bypassCache) {
      try {
        const hit = await this.cache.findOne({ workspaceId: doc.workspaceId, cacheKey }).lean().exec();
        if (hit) return { result: hit.result, assets: (hit.assets ?? []) as StepRunOutput['assets'], usage: { tokens: 0 }, cached: true };
      } catch {
        // best-effort: a cache read failure falls through to a normal call
      }
    }
    const { output, servedBy } = await this.executeWithFallback(
      provider, stepForRun, apiKey, priorResults, inputImages, doc.workspaceId, ledger, attachments,
    );
    // Cache only the PRIMARY's result — a transient fallback must not poison the
    // (provider+model)-keyed cache (cacheKey above was built from the primary).
    if (cacheable && servedBy === provider) {
      try {
        await this.cache
          .updateOne(
            { cacheKey },
            {
              $set: {
                workspaceId: doc.workspaceId,
                cacheKey,
                result: output.result,
                assets: output.assets ?? [],
                expiresAt: new Date(Date.now() + CACHE_TTL_MS),
              },
            },
            { upsert: true },
          )
          .exec();
      } catch {
        // best-effort: a cache write failure must not fail the step
      }
    }
    return output;
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
    ledger: RunLedger,
  ): Promise<StepRunOutput> {
    const step = state.steps[index];
    const cfg = step.fanOut as { over: string; itemVar?: string };
    // Per-item prompts differ; record the template + what it maps over.
    step.sentPrompt = `[fan-out over "${cfg.over}"]\n${step.prompt}`;
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
      return impl.execute({ step: { ...step, prompt }, apiKey, priorResults: [], workspaceId: doc.workspaceId, ledger });
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

  // Run a single-call step through its primary provider; on a RETRYABLE error, retry
  // the same prompt on the other text providers the workspace has a key for (each
  // with its own default model). Eligibility reuses the same gate as `isLocked`, so
  // a provider is never called without its BYO key (invariant 7). The keys lookup is
  // lazy — a healthy primary costs nothing extra. Returns which provider served.
  private async executeWithFallback(
    primary: Provider,
    stepForRun: Step,
    apiKey: string,
    priorResults: PriorStepResult[],
    inputImages: StepInputImage[],
    workspaceId: string,
    ledger: RunLedger,
    attachments: LlmAttachment[] = [],
  ): Promise<{ output: StepRunOutput; servedBy: Provider }> {
    try {
      const output = await this.registry
        .get(primary)
        .execute({ step: stepForRun, apiKey, priorResults, inputImages, attachments, workspaceId, ledger });
      return { output, servedBy: primary };
    } catch (primaryErr) {
      if (!isRetryableProviderError(primaryErr)) throw primaryErr;
      const present = await this.keysPresent(workspaceId);
      const isEligible = (p: Provider) => !providerNeedsKey(p) || present.has(keyProviderFor(p));
      const alts = fallbackChain(primary, isEligible).filter((p) => p !== primary);
      let lastErr = primaryErr;
      for (const alt of alts) {
        const altKey = (await this.keys.getDecrypted(workspaceId, keyProviderFor(alt))) ?? '';
        const altStep = { ...stepForRun, provider: alt, model: defaultModel(alt) };
        try {
          const output = await this.registry
            .get(alt)
            .execute({ step: altStep, apiKey: altKey, priorResults, inputImages, attachments, workspaceId, ledger });
          this.logger.warn(
            `step "${stepForRun.name ?? stepForRun.key ?? ''}": ${primary} failed (${errMessage(primaryErr)}) → served by ${alt}`,
          );
          return { output, servedBy: alt };
        } catch (altErr) {
          lastErr = altErr;
          if (!isRetryableProviderError(altErr)) throw altErr;
        }
      }
      throw lastErr;
    }
  }

  // Run one step: validate, mark running, call the provider, then complete or
  // record the failure. A provider error is persisted on the step (run -> error)
  // and returned, so the workbench can show it.
  async runStep(doc: RunDocument, index: number, actorId: string, bypassCache = false) {
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
      const output = await this.executeStep(doc, state, index, bypassCache);
      if (output.async) {
        submitAsyncStep(state, index, output.async.jobId);
      } else {
        completeStep(state, index, output);
        await this.saveAssets(doc, state, index, output, actorId);
        const issues = await this.reviewAssets(state, index, output);
        if (issues.length) gateForReview(state, index, issues);
      }
    } catch (err) {
      failStep(state, index, errMessage(err));
    }
    try { return await this.persist(doc, state, actorId); }
    catch (e) { return this.translatePersistError(e, state); }
  }

  // Apply an image operation (upscale/variation/outpaint) to a result asset:
  // append a derived Google image step seeded by that exact asset + the op's
  // preset prompt, run only that step, and return the updated run. The parent
  // run's progression (currentStep/status) is left untouched.
  async appendImageAction(
    doc: RunDocument,
    body: { sourceStepIndex: number; assetId: string; op: ImageOp },
    actorId: string,
  ): Promise<RunModel> {
    const state = toState(doc);
    if (state.status === 'running') {
      throw new BadRequestException('Wait for the run to finish before applying an image action.');
    }
    const source = state.steps[body.sourceStepIndex];
    if (!source) throw new BadRequestException('No such source step.');
    if (!source.assetIds?.includes(body.assetId)) {
      throw new BadRequestException('That asset is not part of the selected step.');
    }
    const runAssets = await this.assets.listForRun(doc._id.toString());
    const asset = runAssets.find((a) => a._id.toString() === body.assetId);
    if (!asset || asset.type !== 'image') {
      throw new BadRequestException('Image actions apply to image assets only.');
    }

    const index = state.steps.length;
    const label = IMAGE_OP_PRESETS[body.op].label;
    const sourceName = source.name ?? STEP_DEFS[source.index]?.title ?? `Step ${source.index + 1}`;
    const newStep: Step = {
      index,
      name: `${label} · ${sourceName}`,
      kind: StepKind.Prompt,
      provider: Provider.Google,
      model: 'gemini-2.5-flash-image',
      mode: 'auto' as StepMode,
      status: StepStatus.Idle,
      prompt: imageOpPrompt(body.op),
      inputAssetIds: [body.assetId],
    };
    state.steps.push(newStep);

    beginDerivedStep(state, index);
    try {
      const output = await this.executeStep(doc, state, index, true); // bypassCache: always fresh
      completeDerivedStep(state, index, output);
      await this.saveAssets(doc, state, index, output, actorId);
    } catch (err) {
      failDerivedStep(state, index, errMessage(err));
    }
    try { return await this.persist(doc, state, actorId); }
    catch (e) { return this.translatePersistError(e, state); }
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

  // Post-render asset QA (self-review). When enabled (step.review !== false) and the
  // step produced an http(s) IMAGE asset, run the render-service technical check and
  // return the issue strings (empty = pass). RenderClient.review FAILS OPEN on an
  // outage, so a QA-service problem never gates. Image-only for v1.
  // ponytail: sharp can't decode video; video QA deferred. Non-http urls (e.g. data:)
  // are skipped rather than gated, to avoid false positives.
  private async reviewAssets(state: RunState, index: number, output: StepRunOutput): Promise<string[]> {
    const step = state.steps[index];
    if (step.review === false) return [];
    const image = (output.assets ?? []).find((a) => a.type === 'image' && /^https?:\/\//.test(a.url));
    if (!image) return [];
    const res = await this.renderClient.review({ assetUrl: image.url });
    return res.pass ? [] : res.issues;
  }

  // Advance the run loop: run consecutive steps until a gate pauses, a step is
  // locked (missing key), a step errors, a step submits an async job, or the run
  // completes. Extracted so resumeAfterAsync can reuse the same loop.
  private async advance(doc: RunDocument, state: RunState, present: Set<string>, actorId: string): Promise<void> {
    while (state.status === 'idle' && state.currentStep < state.steps.length) {
      const index = state.currentStep;
      if (shouldSkip(state.steps[index], doc.variables ?? {})) { skipStep(state, index); continue; }
      if (isLocked(state.steps[index], present)) break;
      beginStep(state, index);
      try {
        const output = await this.executeStep(doc, state, index);
        if (output.async) { submitAsyncStep(state, index, output.async.jobId); break; }
        completeStep(state, index, output);
        await this.saveAssets(doc, state, index, output, actorId);
        const issues = await this.reviewAssets(state, index, output);
        if (issues.length) { gateForReview(state, index, issues); break; }
      } catch (err) { failStep(state, index, errMessage(err)); break; }
    }
  }

  // Run consecutive steps until a gate pauses, a step is locked (missing key),
  // a step errors, a step submits an async job, or the run completes.
  async runAll(doc: RunDocument, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    await this.advance(doc, state, present, actorId);
    try { return await this.persist(doc, state, actorId); }
    catch (e) { return this.translatePersistError(e, state); }
  }

  // Called by the poller when an async job finishes successfully. Marks the step
  // done, saves its assets, then continues the run from the next step.
  async resumeAfterAsync(doc: RunDocument, index: number, output: StepRunOutput, actorId: string) {
    const present = await this.keysPresent(doc.workspaceId);
    const state = toState(doc);
    if (state.steps[index]?.status !== StepStatus.Running) return this.persistOrDrop(doc, state, actorId);
    completeStep(state, index, output);
    await this.saveAssets(doc, state, index, output, actorId);
    const issues = await this.reviewAssets(state, index, output);
    if (issues.length) gateForReview(state, index, issues);
    else await this.advance(doc, state, present, actorId);
    return this.persistOrDrop(doc, state, actorId);
  }

  // Returns all runs that have a step with an in-flight async job (for the poller).
  findInFlightAsync(): Promise<RunDocument[]> {
    return this.model.find({ status: 'running', steps: { $elemMatch: { status: StepStatus.Running, jobId: { $exists: true, $ne: null } } } }).exec();
  }

  approveGate(doc: RunDocument, index: number, actorId: string) {
    return this.commit(doc, (s) => this.guard(() => approveGateAt(s, index)), actorId);
  }

  rejectGate(doc: RunDocument, index: number, actorId: string) {
    return this.commit(doc, (s) => this.guard(() => rejectGateAt(s, index)), actorId);
  }

  stop(doc: RunDocument, actorId: string) {
    return this.commit(doc, (s) => stopRun(s), actorId);
  }

  reset(doc: RunDocument, actorId: string) {
    return this.commit(doc, (s) => resetRun(s), actorId);
  }

  async failAsyncStep(doc: RunDocument, index: number, message: string, actorId = 'system') {
    return this.commit(doc, (s) => {
      if (s.steps[index]?.status === StepStatus.Running) failStep(s, index, message);
    }, actorId);
  }

  async updateAsyncProgress(doc: RunDocument, index: number, progress: number | undefined, actorId = 'system') {
    return this.commit(doc, (s) => {
      const step = s.steps[index];
      if (step && step.status === StepStatus.Running && progress !== undefined) step.progress = progress;
    }, actorId);
  }

  async updatePrompt(
    doc: RunDocument,
    index: number,
    prompt: string,
    actorId: string,
  ) {
    let working = doc;
    for (let attempt = 0; ; attempt++) {
      const step = working.steps[index];
      if (!step) throw new BadRequestException('No such step');
      step.prompt = prompt;
      working.updatedBy = actorId;
      try { await working.save(); return this.toView(working); }
      catch (e) {
        if (isVersionError(e) && attempt < COMMIT_MAX_RETRIES) { working = await this.reload(working); continue; }
        throw e;
      }
    }
  }

  // Promote a run step's prompt to the originating pipeline step as an override.
  // Uses the run's recorded provenance (pipelineId + pipelineStepId) — not client
  // input — so the target is always authoritative and workspace-fenced.
  async saveStepToPipeline(run: RunDocument, index: number, actorId: string) {
    if (!run.pipelineId) {
      throw new BadRequestException('This run has no pipeline to save to.');
    }
    const step = run.steps[index];
    if (!step) {
      throw new BadRequestException('No such step.');
    }
    if (!step.pipelineStepId) {
      throw new BadRequestException('This step has no originating pipeline step — it may be a derived or test-run step.');
    }
    return this.pipelines.setStepOverride(
      run.workspaceId,
      run.pipelineId,
      step.pipelineStepId,
      step.prompt,
      actorId,
    );
  }

  // Set or clear the run's overall rating. Allowed only once a step has completed
  // (rating idle output is meaningless). One verdict per run, last-writer-wins.
  async rate(doc: RunDocument, value: 'up' | 'down' | null, actorId: string) {
    let working = doc;
    for (let attempt = 0; ; attempt++) {
      if (!working.steps.some((s) => s.status === StepStatus.Done)) {
        throw new BadRequestException('Rate a run once it has produced a result.');
      }
      working.rating = value === null ? undefined : { value, by: actorId, at: new Date().toISOString() };
      working.markModified('rating');
      working.updatedBy = actorId;
      try { await working.save(); return this.toView(working); }
      catch (e) {
        if (isVersionError(e) && attempt < COMMIT_MAX_RETRIES) { working = await this.reload(working); continue; }
        throw e;
      }
    }
  }
}

function isVersionError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: string }).name === 'VersionError';
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
