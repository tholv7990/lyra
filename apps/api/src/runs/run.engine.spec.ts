import { RunStatus, StepStatus } from '@lyra/shared';
import {
  buildSteps,
  runStepAt,
  approveGateAt,
  runAll,
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

describe('run engine', () => {
  it('builds 8 steps with filled prompts', () => {
    const steps = buildSteps({ product: 'Runner X', niche: 'shoes', homepageUrl: '' });
    expect(steps).toHaveLength(8);
    expect(steps[0].prompt).toContain('Runner X');
    expect(steps.every((s) => s.status === StepStatus.Idle)).toBe(true);
  });

  it('runs autos and pauses at the first gate (Brief = step 2)', () => {
    const s = freshState();
    runAll(s, ALL_KEYS);
    expect(s.currentStep).toBe(2);
    expect(s.status).toBe(RunStatus.AwaitingGate);
    expect(s.steps[0].status).toBe(StepStatus.Done);
    expect(s.steps[1].status).toBe(StepStatus.Done);
    expect(s.steps[2].status).toBe(StepStatus.Waiting);
    expect(s.steps[2].result).toBeTruthy();
  });

  it('walks the full pipeline through all three gates to done', () => {
    const s = freshState();
    runAll(s, ALL_KEYS); // -> gate at 2
    approveGateAt(s, 2);
    expect(s.status).toBe(RunStatus.Idle);
    runAll(s, ALL_KEYS); // insight(3), gate at prompts(4)
    expect(s.currentStep).toBe(4);
    expect(s.status).toBe(RunStatus.AwaitingGate);
    approveGateAt(s, 4);
    runAll(s, ALL_KEYS); // images(5), video(6), gate at qa(7)
    expect(s.currentStep).toBe(7);
    expect(s.status).toBe(RunStatus.AwaitingGate);
    approveGateAt(s, 7);
    expect(s.currentStep).toBe(8);
    expect(s.status).toBe(RunStatus.Done);
    expect(s.steps.every((st) => st.status === StepStatus.Done)).toBe(true);
  });

  it('throws when a step provider key is missing', () => {
    const s = freshState();
    expect(() => runStepAt(s, 0, new Set())).toThrow(StepLockedError);
    // run-all simply stops (no throw) when the next step is locked
    runAll(s, new Set());
    expect(s.currentStep).toBe(0);
    expect(s.status).toBe(RunStatus.Idle);
  });

  it('enforces in-order execution and gate approval', () => {
    const s = freshState();
    expect(() => runStepAt(s, 1, ALL_KEYS)).toThrow(RunTransitionError);
    runAll(s, ALL_KEYS); // awaiting gate at 2
    expect(() => runStepAt(s, 2, ALL_KEYS)).toThrow(RunTransitionError);
  });

  it('resets back to a clean idle run', () => {
    const s = freshState();
    runAll(s, ALL_KEYS);
    resetRun(s);
    expect(s.currentStep).toBe(0);
    expect(s.status).toBe(RunStatus.Idle);
    expect(s.steps.every((st) => st.status === StepStatus.Idle && !st.result)).toBe(true);
  });
});
