import { UnitEconAction } from './unit-econ.action';
const ctx = (econInputs?: any) => ({ action: { type: 'unit-econ' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [], sources: [], data: {}, variables: {}, econInputs } }) as any;
describe('UnitEconAction', () => {
  it('computes unitEcon into data from ledger.econInputs', async () => {
    const out = await new UnitEconAction().execute(ctx({ aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 }));
    expect((out.data as any).unitEcon.cm1).toBeCloseTo(28, 6);
    expect(out.result).toContain('CM1');
  });
  it('throws a clear error when econInputs missing', async () => {
    await expect(new UnitEconAction().execute(ctx(undefined))).rejects.toThrow(/econ|input/i);
  });
  it('computes unitEcon from data.resolvedEconInputs when econInputs is absent', async () => {
    const resolvedCtx = {
      action: { type: 'unit-econ' },
      step: {} as any,
      workspaceId: 'ws',
      priorResults: [],
      ledger: {
        evidence: [],
        sources: [],
        data: { resolvedEconInputs: { aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 } },
        variables: {},
        econInputs: undefined,
      },
    } as any;
    const out = await new UnitEconAction().execute(resolvedCtx);
    expect((out.data as any).unitEcon.cm1).toBeCloseTo(28, 6);
    expect(out.result).toContain('CM1');
  });
});
