import {
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
  Provider,
  STEP_DEFS,
  STEP_PROVIDERS,
  fillPrompt,
  evalCondition,
  type Step,
} from '@lyra/shared';

// Pure run state machine — no Nest, no Mongoose, no I/O. RunsService loads a
// document into a RunState, validates + transitions here, runs the provider
// (the only async/I/O part, in the service), then persists. Keeping the
// transitions pure makes them trivially unit-testable.

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

// Resolve a step's provider: explicit (composable pipeline step) or derived
// from its StepKey (fixed pipeline).
export function providerOf(step: Step): Provider {
  return step.provider ?? STEP_PROVIDERS[step.key as StepKey];
}

export function isLocked(step: Step, keysPresent: Set<string>): boolean {
  return !keysPresent.has(providerOf(step));
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

function now() {
  return new Date().toISOString();
}

// Validate that `index` is the step to run right now. Throws (StepLockedError /
// RunTransitionError) on anything invalid; returns the step otherwise. Pure —
// no mutation, so the service can check before doing async work.
// The ordering/status checks shared by run + skip (no key/lock check). Throws
// (RunTransitionError) on anything invalid; returns the step otherwise.
export function assertStepPosition(state: RunState, index: number): Step {
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
  return step;
}

export function assertRunnable(
  state: RunState,
  index: number,
  keysPresent: Set<string>,
): Step {
  const step = assertStepPosition(state, index);
  if (isLocked(step, keysPresent)) {
    throw new StepLockedError(providerOf(step));
  }
  return step;
}

// True when the step has a guard condition that fails — i.e. it should be skipped
// rather than run. A skipped step makes no provider call (so it needs no key).
export function shouldSkip(
  step: Step,
  vars: Record<string, string | undefined>,
): boolean {
  return !!step.condition && !evalCondition(step.condition, vars);
}

// Mark the step running (before the provider call).
export function beginStep(state: RunState, index: number): void {
  const step = state.steps[index];
  step.status = StepStatus.Running;
  step.startedAt = now();
  step.error = undefined;
  state.status = RunStatus.Running;
}

// Apply a successful provider result and advance: a gate pauses for approval;
// an auto step advances (completing the run after the last step).
export function completeStep(
  state: RunState,
  index: number,
  out: { result: string; usage?: Step['usage'] },
): void {
  const step = state.steps[index];
  step.result = out.result;
  step.usage = out.usage ?? { tokens: 0 };
  step.finishedAt = now();

  if (step.mode === StepMode.Gate) {
    step.status = StepStatus.Waiting;
    state.status = RunStatus.AwaitingGate;
  } else {
    step.status = StepStatus.Done;
    state.currentStep = index + 1;
    state.status =
      state.currentStep >= state.steps.length ? RunStatus.Done : RunStatus.Idle;
  }
}

// A guard condition failed — bypass the step (no provider call) and advance, like
// an auto step completing (a skipped step never gates).
export function skipStep(state: RunState, index: number): void {
  const step = state.steps[index];
  step.status = StepStatus.Skipped;
  step.result = undefined;
  step.error = undefined;
  step.finishedAt = now();
  state.currentStep = index + 1;
  state.status =
    state.currentStep >= state.steps.length ? RunStatus.Done : RunStatus.Idle;
}

// Record a provider failure: the step errors and the run halts in error.
export function failStep(state: RunState, index: number, message: string): void {
  const step = state.steps[index];
  step.status = StepStatus.Error;
  step.error = message;
  step.finishedAt = now();
  state.status = RunStatus.Error;
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
    state.currentStep >= state.steps.length ? RunStatus.Done : RunStatus.Idle;
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
