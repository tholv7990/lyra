import { ActionType, Provider } from '../enums';
import type { Step } from '../models';

export type ResearchPhase = 1 | 2 | 3 | 4;
export interface ResearchPhaseMeta { phase: ResearchPhase; key: 'find' | 'validate' | 'economics' | 'decide'; }

// The 4 user-visible phases (spec §1C). Labels live in web i18n (shared has no i18n).
export const RESEARCH_PHASES: ResearchPhaseMeta[] = [
  { phase: 1, key: 'find' },
  { phase: 2, key: 'validate' },
  { phase: 3, key: 'economics' },
  { phase: 4, key: 'decide' },
];

// Map a step to its research phase by action type, or the leading Research prompt step.
// null for steps that aren't part of a research pipeline.
export function researchPhaseOf(step: Step): ResearchPhase | null {
  switch (step.action?.type) {
    case ActionType.DemandGate: return 2;
    case ActionType.Score:
    case ActionType.UnitEcon:
    case ActionType.RiskScreen: return 3;
    case ActionType.Evaluate:
    case ActionType.SaveProduct: return 4;
    case ActionType.ResolveInputs: return 1;
    case ActionType.Competition: return 2;
    default:
      return step.provider === Provider.Research ? 1 : null;
  }
}

// A research run carries the research-only Evaluate/SaveProduct actions → robust detection.
export function isResearchRun(steps: Step[]): boolean {
  return steps.some((s) => s.action?.type === ActionType.Evaluate || s.action?.type === ActionType.SaveProduct);
}

export interface ResearchPhaseGroup { phase: ResearchPhase; key: ResearchPhaseMeta['key']; steps: Step[]; }

// Group steps into phases in order. A null-phase step inherits the running phase (defaults
// to 1) so the grouping is total + contiguous. Assumes research steps are phase-monotonic
// (the seeded pipeline is).
export function groupByResearchPhase(steps: Step[]): ResearchPhaseGroup[] {
  const byPhase = new Map<ResearchPhase, Step[]>();
  let running: ResearchPhase = 1;
  for (const s of steps) {
    running = researchPhaseOf(s) ?? running;
    const bucket = byPhase.get(running) ?? [];
    bucket.push(s);
    byPhase.set(running, bucket);
  }
  return RESEARCH_PHASES.filter((m) => byPhase.has(m.phase)).map((m) => ({ phase: m.phase, key: m.key, steps: byPhase.get(m.phase)! }));
}
