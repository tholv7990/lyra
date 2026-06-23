import { ResolveInputsAction } from './resolve-inputs.action';

const ctx = (econInputs: any) => ({ action: { type: 'resolve-inputs' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [], sources: [], data: {}, variables: {}, econInputs } }) as any;

describe('ResolveInputsAction', () => {
  it('resolves a complete set with no assumptions', async () => {
    const out = await new ResolveInputsAction().execute(ctx({ aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 }));
    expect((out.data as any).resolvedEconInputs.aov).toBe(50);
    expect((out.data as any).assumptions).toEqual([]);
  });
  it('fills defaults + records assumptions when inputs are missing', async () => {
    const out = await new ResolveInputsAction().execute(ctx({ aov: 40 }));
    expect((out.data as any).resolvedEconInputs.paymentFeePct).toBeCloseTo(0.029, 6);
    expect((out.data as any).assumptions.length).toBeGreaterThan(0);
    expect(out.result).toMatch(/assum/i);
  });
});
