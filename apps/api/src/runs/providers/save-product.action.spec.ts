import { SaveProductAction } from './save-product.action';
const ctx = (over: any = {}) => ({ action: { type: 'save-product' }, step: {} as any, workspaceId: 'ws', productId: 'noProductId' in over ? over.noProductId : 'p1', priorResults: [],
  ledger: { evidence: [{ id: 'c1', statement: 'a', kind: 'estimate', sourceId: 's1', quote: 'a' }], sources: [{ id: 's1', name: 'S', url: 'u', accessDate: 'd', primary: false, alive: true }], econInputs: { aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 }, data: { unitEcon: { cm1: 5 }, score: 80, grade: 'B', decision: 'TEST_NOW', subScores: {}, hardGates: { unresolvedSafety: false, materialIpRisk: false, negativeUnitEcon: false, cpaExceedsMaxCac: false, singleSourceDemand: false, misleadingClaimsRequired: false }, assumptions: ['Assumed AOV $30'], competition: { competitors: [], marketType: 'emerging' }, riskFlags: { unresolvedSafety: false, materialIpRisk: false, misleadingClaimsRequired: false }, riskNotes: [], scenarios: { base: { cm1: 5 } }, customerJob: { customer: 'p', job: 'j', problem: '', alternative: '', trigger: '' }, reviewMining: { complaints: [], desiredFeatures: [], objections: [] }, creativeConcepts: [], supplyChain: { suppliers: [], certs: [], notes: [] }, validationPlan: { offer: 'o', landingPageHypothesis: '', creatives: [], channel: '', decisionRule: '' } }, variables: {} } }) as any;
describe('SaveProductAction', () => {
  it('saves the ledger to a Product via applyResearch', async () => {
    const products = { applyResearch: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const out = await new SaveProductAction(products as any).execute(ctx());
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({ score: 80, decision: 'TEST_NOW' }));
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({
      hardGates: expect.objectContaining({ singleSourceDemand: false }),
      unitEconInputs: expect.objectContaining({ aov: 50 }),
    }));
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({
      assumptions: ['Assumed AOV $30'],
      competition: expect.objectContaining({ marketType: 'emerging' }),
    }));
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({
      riskFlags: expect.any(Object),
      scenarios: expect.any(Object),
    }));
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({
      customerJob: expect.any(Object),
      supplyChain: expect.any(Object),
    }));
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({ validationPlan: expect.any(Object) }));
    expect((out.data as any).productId).toBe('p1');
  });
  it('skips persist on a builder test run (no productId)', async () => {
    const products = { applyResearch: jest.fn() };
    const out = await new SaveProductAction(products as any).execute(ctx({ noProductId: undefined }));
    expect(products.applyResearch).not.toHaveBeenCalled();
    expect(out.result).toMatch(/no product|test run/i);
  });
});
