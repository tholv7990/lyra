import { describe, it, expect } from 'vitest';
import { ActionType, Provider } from '../enums';
import type { Step } from '../models';
import { researchPhaseOf, isResearchRun, groupByResearchPhase } from './research-phases';

const step = (over: Partial<Step>): Step => ({ index: 0, mode: 'auto' as never, status: 'idle' as never, model: '', prompt: '', ...over });
const researchSteps: Step[] = [
  step({ index: 0, name: 'Research', provider: Provider.Research }),
  step({ index: 1, name: 'Demand gate', action: { type: ActionType.DemandGate } as never }),
  step({ index: 2, name: 'Score', action: { type: ActionType.Score } as never }),
  step({ index: 3, name: 'Unit economics', action: { type: ActionType.UnitEcon } as never }),
  step({ index: 4, name: 'Evaluate', action: { type: ActionType.Evaluate } as never }),
  step({ index: 5, name: 'Save & review', action: { type: ActionType.SaveProduct } as never }),
];

describe('researchPhaseOf', () => {
  it('maps each step to its phase', () => {
    expect(researchSteps.map(researchPhaseOf)).toEqual([1, 2, 3, 3, 4, 4]);
  });
  it('returns null for a non-research step', () => {
    expect(researchPhaseOf(step({ provider: Provider.OpenAI, action: { type: ActionType.Crawl, source: 'input' } as never }))).toBeNull();
    expect(researchPhaseOf(step({ provider: Provider.OpenAI }))).toBeNull();
  });
  it('maps resolve-inputs to phase 1 and competition to phase 2', () => {
    expect(researchPhaseOf(step({ action: { type: ActionType.ResolveInputs } as never }))).toBe(1);
    expect(researchPhaseOf(step({ action: { type: ActionType.Competition } as never }))).toBe(2);
  });
});

describe('isResearchRun', () => {
  it('true for the seeded research steps, false for a generic pipeline', () => {
    expect(isResearchRun(researchSteps)).toBe(true);
    expect(isResearchRun([step({ provider: Provider.OpenAI }), step({ action: { type: ActionType.Brand } as never })])).toBe(false);
  });
});

describe('groupByResearchPhase', () => {
  it('groups the seeded pipeline into 4 contiguous phases in order', () => {
    const groups = groupByResearchPhase(researchSteps);
    expect(groups.map((g) => g.key)).toEqual(['find', 'validate', 'economics', 'decide']);
    expect(groups.map((g) => g.steps.length)).toEqual([1, 1, 2, 2]);
    expect(groups[3].steps.map((s) => s.index)).toEqual([4, 5]);
  });
});
