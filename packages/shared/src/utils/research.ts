import type {
  UnitEconInputs, UnitEcon, EvidenceClaim, ConfidenceGrade, HardGates, Decision,
} from '../models';
import { WEIGHTS, type SubScores } from '../constants/research';

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

// Final decision (spec §1E). Hard gates override the score bands: legal/ethical/
// economics dealbreakers fail outright; thin-but-fixable issues route to a cheaper
// path. With no gates, the weighted score picks the band.
export function decide(score: number, gates: HardGates): Decision {
  if (gates.unresolvedSafety || gates.materialIpRisk || gates.misleadingClaimsRequired) return 'REJECT';
  if (gates.negativeUnitEcon) return 'REJECT';
  if (gates.cpaExceedsMaxCac) return 'RESOLVE_GAPS';
  if (gates.singleSourceDemand) return 'LOW_COST_VALIDATION';
  if (score >= 75) return 'TEST_NOW';
  if (score >= 60) return 'RESOLVE_GAPS';
  if (score >= 45) return 'LOW_COST_VALIDATION';
  return 'PARK';
}
