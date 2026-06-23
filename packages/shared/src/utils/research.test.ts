import { describe, it, expect } from 'vitest';
import { computeUnitEcon, weightedScore, gradeConfidence, decide } from './research';
import { WEIGHTS } from '../constants/research';
import type { SubScores, EvidenceClaim, HardGates } from '../index';

const noGates: HardGates = {
  unresolvedSafety: false, materialIpRisk: false, negativeUnitEcon: false,
  cpaExceedsMaxCac: false, singleSourceDemand: false, misleadingClaimsRequired: false,
};

describe('WEIGHTS', () => {
  it('sums to 100', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('computeUnitEcon', () => {
  it('computes cm1, break-even, max CAC, target ROAS', () => {
    const r = computeUnitEcon({
      aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4,
      shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0,
      desiredPostAdCmPct: 0.15,
    });
    expect(r.cm1).toBeCloseTo(28, 6);
    expect(r.cm1Pct).toBeCloseTo(0.56, 6);
    expect(r.breakEvenRoas).toBeCloseTo(1 / 0.56, 6);
    expect(r.maxCac).toBeCloseTo(50 * (0.56 - 0.15), 6);
    expect(r.targetRoas).toBeCloseTo(50 / 20.5, 6);
  });
  it('guards negative unit economics (Infinity, not NaN)', () => {
    const r = computeUnitEcon({
      aov: 10, landedCost: 20, paymentFeePct: 0, fulfillment: 0,
      shippingSubsidy: 0, expectedReturnLossPct: 0, warrantyReservePct: 0,
      desiredPostAdCmPct: 0.1,
    });
    expect(r.cm1).toBe(-10);
    expect(r.breakEvenRoas).toBe(Infinity);
    expect(r.targetRoas).toBe(Infinity);
  });
});

describe('weightedScore', () => {
  it('all 5s → 100; all 0s → 0; clamps out-of-range', () => {
    const all = (n: number) => Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, n])) as SubScores;
    expect(weightedScore(all(5))).toBeCloseTo(100, 6);
    expect(weightedScore(all(0))).toBe(0);
    expect(weightedScore(all(99))).toBeCloseTo(100, 6);
  });
});

describe('gradeConfidence', () => {
  const claim = (sourceId: string, purchaseData = false): EvidenceClaim =>
    ({ id: sourceId, statement: 's', kind: 'verified', sourceId, purchaseData });
  it('A: purchase data + >=3 sources', () => {
    expect(gradeConfidence([claim('a', true), claim('b'), claim('c')])).toBe('A');
  });
  it('B: >=3 sources, no purchase data', () => {
    expect(gradeConfidence([claim('a'), claim('b'), claim('c')])).toBe('B');
  });
  it('C: exactly 2 sources', () => {
    expect(gradeConfidence([claim('a'), claim('b')])).toBe('C');
  });
  it('D: <=1 source', () => {
    expect(gradeConfidence([claim('a')])).toBe('D');
    expect(gradeConfidence([])).toBe('D');
  });
});

describe('decide', () => {
  it('hard gates override score', () => {
    expect(decide(99, { ...noGates, unresolvedSafety: true })).toBe('REJECT');
    expect(decide(99, { ...noGates, negativeUnitEcon: true })).toBe('REJECT');
    expect(decide(99, { ...noGates, cpaExceedsMaxCac: true })).toBe('RESOLVE_GAPS');
    expect(decide(99, { ...noGates, singleSourceDemand: true })).toBe('LOW_COST_VALIDATION');
  });
  it('score bands when no gates', () => {
    expect(decide(80, noGates)).toBe('TEST_NOW');
    expect(decide(65, noGates)).toBe('RESOLVE_GAPS');
    expect(decide(50, noGates)).toBe('LOW_COST_VALIDATION');
    expect(decide(20, noGates)).toBe('PARK');
  });
});

import { decideWithReason } from './research';

describe('decideWithReason + non-compensatory floors', () => {
  const mid: SubScores = Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, 4])) as SubScores;

  it('a critical factor at 1 caps TEST_NOW down to RESOLVE_GAPS', () => {
    const subs = { ...mid, riskCompliance: 1 };
    const r = decideWithReason(90, noGates, subs);
    expect(r.decision).toBe('RESOLVE_GAPS');
    expect(r.reason).toMatch(/floor: riskCompliance 1\/5/);
  });

  it('a critical factor at 0 caps down to LOW_COST_VALIDATION', () => {
    const subs = { ...mid, unitEconomics: 0 };
    expect(decideWithReason(90, noGates, subs).decision).toBe('LOW_COST_VALIDATION');
  });

  it('a non-critical factor at 0 does NOT cap', () => {
    const subs = { ...mid, creativePotential: 0 };
    expect(decideWithReason(90, noGates, subs).decision).toBe('TEST_NOW');
  });

  it('a REJECT gate is never raised by a clean floor', () => {
    const r = decideWithReason(90, { ...noGates, unresolvedSafety: true }, mid);
    expect(r.decision).toBe('REJECT');
    expect(r.reason).toMatch(/gate/);
  });

  it('floor never raises a decision (LOW_COST band stays LOW_COST)', () => {
    expect(decideWithReason(50, noGates, { ...mid, demandIntent: 1 }).decision).toBe('LOW_COST_VALIDATION');
  });

  it('decide() with no subScores is unchanged', () => {
    expect(decideWithReason(80, noGates).decision).toBe('TEST_NOW');
    expect(decideWithReason(80, noGates).reason).toMatch(/band/);
  });
});

import { resolveInputs, runScenarios } from './research';

describe('runScenarios', () => {
  const base = { aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 };
  it('perturbs each case in the expected direction', () => {
    const s = runScenarios(base);
    expect(s.low.cm1).toBeLessThan(s.base.cm1);
    expect(s.high.cm1).toBeGreaterThan(s.base.cm1);
    expect(s.plus10Landed.cm1).toBeLessThan(s.base.cm1);
    expect(s.doubleReturns.cm1).toBeLessThan(s.base.cm1);
    expect(s.plus10Cac.cm1).toBeCloseTo(s.base.cm1, 6);
    expect(s.plus10Cac.maxCac).toBeLessThan(s.base.maxCac);
  });
});

describe('resolveInputs', () => {
  const full = { aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 };
  it('a complete input set produces no assumptions', () => {
    const r = resolveInputs(full);
    expect(r.inputs).toEqual(full);
    expect(r.assumptions).toEqual([]);
  });
  it('fills each missing field with a default and records an assumption', () => {
    const r = resolveInputs({ aov: 40 });
    expect(r.inputs.aov).toBe(40);
    expect(r.inputs.paymentFeePct).toBeCloseTo(0.029, 6);
    expect(r.inputs.landedCost).toBe(12); // round(40 * 0.30)
    expect(r.inputs.desiredPostAdCmPct).toBeCloseTo(0.15, 6);
    expect(r.assumptions.length).toBe(7); // all but aov
    expect(r.assumptions.some((a) => /payment fee/i.test(a))).toBe(true);
  });
  it('falls back AOV to targetPrice, then to 30', () => {
    expect(resolveInputs({ targetPrice: 55 }).inputs.aov).toBe(55);
    expect(resolveInputs({}).inputs.aov).toBe(30);
    expect(resolveInputs({}).assumptions.some((a) => /AOV/i.test(a))).toBe(true);
  });
});
