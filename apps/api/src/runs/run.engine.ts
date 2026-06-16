import {
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
  Provider,
  STEP_DEFS,
  STEP_PROVIDERS,
  fillPrompt,
  type Step,
} from '@lyra/shared';

// Pure run state machine — no Nest, no Mongoose, no I/O. RunsService loads a
// document into a RunState, applies these transitions, and persists. Keeping it
// pure makes the orchestrator transitions trivially unit-testable.

export interface RunState {
  status: RunStatus;
  currentStep: number;
  steps: Step[];
}

export interface ProjectInfo {
  product: string;
  niche: string;
  homepageUrl: string;
}

export const TOTAL_STEPS = STEP_DEFS.length;

export class StepLockedError extends Error {
  constructor(public readonly provider: Provider) {
    super(`Missing provider key: ${provider}`);
    this.name = 'StepLockedError';
  }
}

export class RunTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunTransitionError';
  }
}

export function providerForStep(key: StepKey): Provider {
  return STEP_PROVIDERS[key];
}

export function isLocked(step: Step, keysPresent: Set<string>): boolean {
  return !keysPresent.has(STEP_PROVIDERS[step.key]);
}

export function buildSteps(p: ProjectInfo): Step[] {
  return STEP_DEFS.map((d) => ({
    index: d.index,
    key: d.key,
    mode: d.mode,
    status: StepStatus.Idle,
    model: d.owner,
    prompt: fillPrompt(d.promptTemplate, {
      product: p.product,
      niche: p.niche,
      homepage: p.homepageUrl,
    }),
  }));
}

// Deterministic mock output per step — no provider calls, no spend.
function fakeResult(step: Step): string {
  switch (step.key) {
    case StepKey.Find:
      return '[mock] 9 competitor sources found, each with URL, hook, format, and why it performs.';
    case StepKey.Crawl:
      return '[mock] Crawled sources → structured JSON: ad copy, hooks, specs, price points, visual patterns.';
    case StepKey.Brief:
      return '[mock] Brand brief: color story, product details, voice/tone, the Quiet Hero arc. (gate — review & approve)';
    case StepKey.Insight:
      return '[mock] Competitor insight: winning angles, repeated visual patterns, the gap to own, tropes to avoid.';
    case StepKey.Prompts:
      return '[mock] 9 image prompts + 3 UGC scripts generated. (gate — review & approve)';
    case StepKey.Images:
      return '[mock] Rendered 9 stills (hero, grip detail, lifestyle ×3, studio ×2, before/after, packaging).';
    case StepKey.Video:
      return '[mock] Produced 3 avatar UGC ads + 1 cinematic b-roll cut with brand-matched voiceover.';
    case StepKey.QA:
      return '[mock] Assembled batch: logo + grade + captions applied, brand fit & product accuracy checked. (gate — approve to ship)';
    default:
      return '[mock] step complete.';
  }
}

function now() {
  return new Date().toISOString();
}

// Run the step at `index` (must be the current step). Auto steps advance; gate
// steps produce their result then pause the run for approval.
export function runStepAt(
  state: RunState,
  index: number,
  keysPresent: Set<string>,
): void {
  if (state.status === RunStatus.AwaitingGate) {
    throw new RunTransitionError('Approve the current gate before running more steps');
  }
  if (state.status === RunStatus.Done) {
    throw new RunTransitionError('Run is already complete');
  }
  if (index !== state.currentStep) {
    throw new RunTransitionError('Steps must run in order');
  }
  const step = state.steps[index];
  if (!step) throw new RunTransitionError('No such step');
  if (step.status === StepStatus.Done) {
    throw new RunTransitionError('Step is already done');
  }
  if (isLocked(step, keysPresent)) {
    throw new StepLockedError(providerForStep(step.key));
  }

  step.status = StepStatus.Running;
  step.startedAt = now();
  step.error = undefined;
  step.result = fakeResult(step);
  step.usage = { tokens: 0, costUsd: 0 };
  step.finishedAt = now();

  if (step.mode === StepMode.Gate) {
    step.status = StepStatus.Waiting;
    state.status = RunStatus.AwaitingGate;
  } else {
    step.status = StepStatus.Done;
    state.currentStep = index + 1;
    state.status =
      state.currentStep >= TOTAL_STEPS ? RunStatus.Done : RunStatus.Idle;
  }
}

export function approveGateAt(state: RunState, index: number): void {
  if (state.status !== RunStatus.AwaitingGate) {
    throw new RunTransitionError('No gate is awaiting approval');
  }
  const step = state.steps[index];
  if (!step || index !== state.currentStep || step.status !== StepStatus.Waiting) {
    throw new RunTransitionError('No such gate to approve');
  }
  step.status = StepStatus.Done;
  state.currentStep = index + 1;
  state.status =
    state.currentStep >= TOTAL_STEPS ? RunStatus.Done : RunStatus.Idle;
}

// Run consecutive steps until a gate pauses the run, a step is locked (missing
// key), or the run completes.
export function runAll(state: RunState, keysPresent: Set<string>): void {
  while (state.status === RunStatus.Idle && state.currentStep < TOTAL_STEPS) {
    const step = state.steps[state.currentStep];
    if (isLocked(step, keysPresent)) break;
    runStepAt(state, state.currentStep, keysPresent);
  }
}

export function stopRun(state: RunState): void {
  for (const step of state.steps) {
    if (step.status === StepStatus.Running || step.status === StepStatus.Queued) {
      step.status = StepStatus.Idle;
    }
  }
  if (state.status === RunStatus.Running) state.status = RunStatus.Idle;
}

export function resetRun(state: RunState): void {
  for (const step of state.steps) {
    step.status = StepStatus.Idle;
    step.result = undefined;
    step.assetIds = undefined;
    step.usage = undefined;
    step.error = undefined;
    step.startedAt = undefined;
    step.finishedAt = undefined;
  }
  state.currentStep = 0;
  state.status = RunStatus.Idle;
}
