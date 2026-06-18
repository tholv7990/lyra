import { describe, it, expect } from 'vitest';
import {
  gettingStartedSteps,
  gettingStartedProgress,
  type WorkspaceStats,
} from './gettingStarted';

const stats = (s: Partial<WorkspaceStats> = {}): WorkspaceStats => ({
  keys: 0,
  prompts: 0,
  pipelines: 0,
  projects: 0,
  ...s,
});

describe('gettingStartedSteps', () => {
  it('returns the four onboarding steps in mental-model order with stable routes', () => {
    const steps = gettingStartedSteps(stats());
    expect(steps.map((s) => s.key)).toEqual(['keys', 'prompt', 'pipeline', 'project']);
    expect(steps.map((s) => s.to)).toEqual(['/settings', '/chats', '/pipelines', '/projects']);
  });

  it('marks a step done only when its workspace count is positive', () => {
    const steps = gettingStartedSteps(stats({ keys: 2, pipelines: 1 }));
    expect(steps.find((s) => s.key === 'keys')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'pipeline')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'prompt')?.done).toBe(false);
    expect(steps.find((s) => s.key === 'project')?.done).toBe(false);
  });
});

describe('gettingStartedProgress', () => {
  it('is empty + active on the first step for a brand-new workspace', () => {
    const p = gettingStartedProgress(gettingStartedSteps(stats()));
    expect(p).toMatchObject({ done: 0, total: 4, complete: false, activeIndex: 0, ratio: 0 });
  });

  it('is complete with no active step once everything has at least one item', () => {
    const p = gettingStartedProgress(
      gettingStartedSteps(stats({ keys: 1, prompts: 3, pipelines: 1, projects: 1 })),
    );
    expect(p).toMatchObject({ done: 4, total: 4, complete: true, activeIndex: -1, ratio: 1 });
  });

  it('highlights the FIRST incomplete step even when a later step is already done', () => {
    // keys missing but prompts exist: the active step is still "keys" (index 0),
    // so the checklist nudges the genuinely-missing prerequisite, not the next gap.
    const p = gettingStartedProgress(gettingStartedSteps(stats({ prompts: 5 })));
    expect(p.done).toBe(1);
    expect(p.activeIndex).toBe(0);
    expect(p.complete).toBe(false);
    expect(p.ratio).toBeCloseTo(0.25);
  });
});
