import { RunStatus, StepStatus, Provider, StepKind, ActionType, type Step } from '@lyra/shared';
import {
  buildSteps,
  assertRunnable,
  isLocked,
  beginStep,
  completeStep,
  failStep,
  approveGateAt,
  rejectGateAt,
  resetRun,
  StepLockedError,
  RunTransitionError,
  type RunState,
} from './run.engine';

const ALL_KEYS = new Set(['openai', 'deepseek', 'anthropic', 'image', 'video']);

function freshState(): RunState {
  return {
    status: RunStatus.Idle,
    currentStep: 0,
    steps: buildSteps({ product: 'Runner X', niche: 'footwear', homepageUrl: '' }),
  };
}

// Mirror what the service does for one step: validate -> begin -> complete.
function runStep(s: RunState, index: number, keys = ALL_KEYS, result = 'ok') {
  assertRunnable(s, index, keys);
  beginStep(s, index);
  completeStep(s, index, { result });
}

describe('isLocked (action steps need no provider key — invariant 7)', () => {
  it('never locks an action step, even with no keys present', () => {
    const actionStep = {
      provider: Provider.Anthropic, // stale builder default — must be ignored
      kind: StepKind.Action,
      action: { type: ActionType.Brand, position: 'br', size: 'md' },
    } as unknown as Step;
    expect(isLocked(actionStep, new Set())).toBe(false);
  });

  it('still locks a prompt step whose provider key is absent', () => {
    const promptStep = { provider: Provider.Anthropic } as unknown as Step;
    expect(isLocked(promptStep, new Set())).toBe(true);
  });
});

describe('run engine', () => {
  it('builds 8 steps with filled prompts', () => {
    const steps = buildSteps({ product: 'Runner X', niche: 'shoes', homepageUrl: '' });
    expect(steps).toHaveLength(8);
    expect(steps[0].prompt).toContain('Runner X');
    expect(steps.every((s) => s.status === StepStatus.Idle)).toBe(true);
  });

  it('advances on auto steps and pauses at the first gate (Brief = step 2)', () => {
    const s = freshState();
    runStep(s, 0); // Find (auto)
    expect(s.currentStep).toBe(1);
    expect(s.steps[0].status).toBe(StepStatus.Done);
    runStep(s, 1); // Crawl (auto)
    expect(s.currentStep).toBe(2);
    runStep(s, 2); // Brief (gate)
    expect(s.status).toBe(RunStatus.AwaitingGate);
    expect(s.steps[2].status).toBe(StepStatus.Waiting);
    expect(s.steps[2].result).toBe('ok');
    expect(s.currentStep).toBe(2);
  });

  it('walks the full pipeline through all three gates to done', () => {
    const s = freshState();
    runStep(s, 0);
    runStep(s, 1);
    runStep(s, 2); // gate Brief
    approveGateAt(s, 2);
    expect(s.status).toBe(RunStatus.Idle);
    runStep(s, 3); // Insight (auto)
    runStep(s, 4); // gate Prompts
    expect(s.status).toBe(RunStatus.AwaitingGate);
    approveGateAt(s, 4);
    runStep(s, 5); // Images
    runStep(s, 6); // Video
    runStep(s, 7); // gate QA
    expect(s.status).toBe(RunStatus.AwaitingGate);
    approveGateAt(s, 7);
    expect(s.currentStep).toBe(8);
    expect(s.status).toBe(RunStatus.Done);
    expect(s.steps.every((st) => st.status === StepStatus.Done)).toBe(true);
  });

  it('rejecting a gate returns the step to idle and pauses for a re-run', () => {
    const s = freshState();
    runStep(s, 0);
    runStep(s, 1);
    runStep(s, 2); // gate Brief
    expect(s.status).toBe(RunStatus.AwaitingGate);
    rejectGateAt(s, 2);
    expect(s.status).toBe(RunStatus.Idle);
    expect(s.steps[2].status).toBe(StepStatus.Idle);
    expect(s.currentStep).toBe(2); // still on the rejected step
    expect(() => assertRunnable(s, 2, ALL_KEYS)).not.toThrow(); // can re-run it
  });

  it('throws when rejecting with no gate awaiting', () => {
    const s = freshState();
    expect(() => rejectGateAt(s, 0)).toThrow(RunTransitionError);
  });

  it('rejects running a step whose provider key is missing', () => {
    const s = freshState();
    expect(() => assertRunnable(s, 0, new Set())).toThrow(StepLockedError);
  });

  it('enforces in-order execution and gate approval', () => {
    const s = freshState();
    expect(() => assertRunnable(s, 1, ALL_KEYS)).toThrow(RunTransitionError);
    runStep(s, 0);
    runStep(s, 1);
    runStep(s, 2); // awaiting gate at 2
    expect(() => assertRunnable(s, 2, ALL_KEYS)).toThrow(RunTransitionError);
    expect(() => assertRunnable(s, 3, ALL_KEYS)).toThrow(RunTransitionError);
  });

  it('marks a step running, then records a provider failure', () => {
    const s = freshState();
    beginStep(s, 0);
    expect(s.steps[0].status).toBe(StepStatus.Running);
    expect(s.steps[0].startedAt).toBeTruthy();
    failStep(s, 0, 'Claude returned an empty response');
    expect(s.steps[0].status).toBe(StepStatus.Error);
    expect(s.steps[0].error).toBe('Claude returned an empty response');
    expect(s.status).toBe(RunStatus.Error);
  });

  it('resets back to a clean idle run', () => {
    const s = freshState();
    runStep(s, 0);
    runStep(s, 1);
    resetRun(s);
    expect(s.currentStep).toBe(0);
    expect(s.status).toBe(RunStatus.Idle);
    expect(s.steps.every((st) => st.status === StepStatus.Idle && !st.result)).toBe(true);
  });
});
