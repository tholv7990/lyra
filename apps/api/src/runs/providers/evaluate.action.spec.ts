import { EvaluateAction } from './evaluate.action';
const led = (over: any) => ({ evidence: [], sources: [], data: {}, variables: {}, ...over });
const ctx = (ledger: any) => ({ action: { type: 'evaluate' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger }) as any;
const fullScores = { demandIntent: 5, trendDurability: 5, problemIntensity: 5, whitespace: 5, unitEconomics: 5, creativePotential: 5, channelFit: 5, supplyQuality: 5, riskCompliance: 5, expansionValue: 5 };
describe('EvaluateAction', () => {
  it('scores/grades/decides from the ledger', async () => {
    const out = await new EvaluateAction().execute(ctx(led({ data: { subScores: fullScores, unitEcon: { cm1: 10, cm1Pct: 0.5, breakEvenRoas: 2, maxCac: 10, targetRoas: 2 } }, evidence: [
      { id: 'c1', statement: 'a', kind: 'verified', sourceId: 's1' }, { id: 'c2', statement: 'b', kind: 'verified', sourceId: 's2' }, { id: 'c3', statement: 'c', kind: 'verified', sourceId: 's3' },
    ] })));
    expect((out.data as any).score).toBeCloseTo(100, 0);
    expect((out.data as any).decision).toBe('TEST_NOW');
  });
  it('negative unit econ → REJECT via derived hard gate', async () => {
    const out = await new EvaluateAction().execute(ctx(led({ data: { subScores: fullScores, unitEcon: { cm1: -5, cm1Pct: -0.1, breakEvenRoas: Infinity, maxCac: -1, targetRoas: Infinity } } })));
    expect((out.data as any).decision).toBe('REJECT');
  });
  it('missing subScores → clear error', async () => {
    await expect(new EvaluateAction().execute(ctx(led({ data: {} })))).rejects.toThrow(/score/i);
  });
  it('riskFlags.materialIpRisk → REJECT', async () => {
    const out = await new EvaluateAction().execute(ctx(led({ data: { subScores: fullScores, unitEcon: { cm1: 10, cm1Pct: 0.5, breakEvenRoas: 2, maxCac: 10, targetRoas: 2 }, riskFlags: { materialIpRisk: true, unresolvedSafety: false, misleadingClaimsRequired: false } }, evidence: [
      { id: 'c1', statement: 'a', kind: 'verified', sourceId: 's1' }, { id: 'c2', statement: 'b', kind: 'verified', sourceId: 's2' }, { id: 'c3', statement: 'c', kind: 'verified', sourceId: 's3' },
    ] })));
    expect((out.data as any).decision).toBe('REJECT');
  });
});
