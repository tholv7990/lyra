import type {
  UnitEconInputs, UnitEcon, EvidenceClaim, ConfidenceGrade, HardGates, Decision,
} from '../models';
import { WEIGHTS, type SubScores, type ScoreKey } from '../constants/research';

// CM1 and the derived ad-efficiency thresholds (spec §1D). The LLM supplies the
// tagged cost inputs; ALL arithmetic is here. Percentages are fractions of AOV.
export function computeUnitEcon(i: UnitEconInputs): UnitEcon {
  const aov = i.aov;
  const variableCosts =
    i.landedCost +
    aov * i.paymentFeePct +
    i.fulfillment +
    i.shippingSubsidy +
    aov * i.expectedReturnLossPct +
    aov * i.warrantyReservePct;
  const cm1 = aov - variableCosts;
  const cm1Pct = aov > 0 ? cm1 / aov : 0;
  const breakEvenRoas = cm1Pct > 0 ? 1 / cm1Pct : Infinity;
  const maxCac = aov * (cm1Pct - i.desiredPostAdCmPct);
  const targetRoas = maxCac > 0 ? aov / maxCac : Infinity;
  return { cm1, cm1Pct, breakEvenRoas, maxCac, targetRoas };
}

// Weighted 0..100 total from the 0..5 sub-scores (spec §1E). Out-of-range sub-scores
// are clamped to [0,5] so a bad LLM extraction can't blow past 100.
export function weightedScore(s: SubScores): number {
  let total = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const sub = Math.max(0, Math.min(5, s[k] ?? 0));
    total += WEIGHTS[k] * (sub / 5);
  }
  return total;
}

// Confidence grade from the evidence set (spec §1E). "Independent sources" = distinct
// sourceId; grade A also requires a direct purchase-data claim.
export function gradeConfidence(evidence: EvidenceClaim[]): ConfidenceGrade {
  const sources = new Set(evidence.filter((c) => c.sourceId).map((c) => c.sourceId));
  const n = sources.size;
  const hasPurchaseData = evidence.some((c) => c.purchaseData);
  if (hasPurchaseData && n >= 3) return 'A';
  if (n >= 3) return 'B';
  if (n === 2) return 'C';
  return 'D';
}

// Decision severity — higher = worse. Gates and floors can only push DOWN (toward worse).
const SEVERITY: Record<Decision, number> = {
  TEST_NOW: 0, RESOLVE_GAPS: 1, LOW_COST_VALIDATION: 2, PARK: 3, REJECT: 4,
};

// Factors where a near-zero rating is a dealbreaker the weighted sum must not mask
// (no economics / legal-safety risk / no demand). The other 7 stay compensatory.
export const CRITICAL_FACTORS: ScoreKey[] = ['unitEconomics', 'riskCompliance', 'demandIntent'];

export interface DecisionExplained { decision: Decision; reason: string; }

// Final decision + a one-line reason (spec §1E + deep-research C3). Hard gates first
// (legal/ethical/economics dealbreakers, thin-but-fixable routes), then the score band,
// then NON-COMPENSATORY floors pull the result DOWN when a critical factor is near-zero.
// Floors never raise a decision.
export function decideWithReason(score: number, gates: HardGates, subScores?: SubScores): DecisionExplained {
  let base: DecisionExplained;
  if (gates.unresolvedSafety) base = { decision: 'REJECT', reason: 'gate: unresolved safety' };
  else if (gates.materialIpRisk) base = { decision: 'REJECT', reason: 'gate: material IP risk' };
  else if (gates.misleadingClaimsRequired) base = { decision: 'REJECT', reason: 'gate: misleading claims required' };
  else if (gates.negativeUnitEcon) base = { decision: 'REJECT', reason: 'gate: negative unit economics' };
  else if (gates.cpaExceedsMaxCac) base = { decision: 'RESOLVE_GAPS', reason: 'gate: CPA exceeds max CAC' };
  else if (gates.singleSourceDemand) base = { decision: 'LOW_COST_VALIDATION', reason: 'gate: single-source demand' };
  else if (score >= 75) base = { decision: 'TEST_NOW', reason: 'band: score >=75' };
  else if (score >= 60) base = { decision: 'RESOLVE_GAPS', reason: 'band: score >=60' };
  else if (score >= 45) base = { decision: 'LOW_COST_VALIDATION', reason: 'band: score >=45' };
  else base = { decision: 'PARK', reason: 'band: score <45' };

  if (!subScores) return base;

  // Most-severe cap implied by any critical factor (0 → LOW_COST_VALIDATION, <=1 → RESOLVE_GAPS).
  let cap: DecisionExplained | null = null;
  for (const f of CRITICAL_FACTORS) {
    const s = Math.max(0, Math.min(5, subScores[f] ?? 0));
    const c: Decision | null = s === 0 ? 'LOW_COST_VALIDATION' : s <= 1 ? 'RESOLVE_GAPS' : null;
    if (c && (!cap || SEVERITY[c] > SEVERITY[cap.decision])) cap = { decision: c, reason: `floor: ${f} ${s}/5` };
  }
  // Result = the worse of base and cap; reason follows whichever bound it.
  return cap && SEVERITY[cap.decision] > SEVERITY[base.decision] ? cap : base;
}

export function decide(score: number, gates: HardGates, subScores?: SubScores): Decision {
  return decideWithReason(score, gates, subScores).decision;
}
