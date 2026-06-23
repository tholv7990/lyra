import { DemandGateAction } from './demand-gate.action';

const ctx = (evidence: any[]) => ({ action: { type: 'demand-gate' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence, sources: [], data: {}, variables: {} } }) as any;
const sig = (sourceId: string) => ({ id: sourceId, statement: 's', kind: 'estimate', sourceId, demandSignal: true });

describe('DemandGateAction', () => {
  it('passes with >=3 distinct-source demand signals', async () => {
    const out = await new DemandGateAction().execute(ctx([sig('s1'), sig('s2'), sig('s3')]));
    expect((out.data as any).demandSignals).toBe(3);
  });
  it('fails with <3', async () => {
    await expect(new DemandGateAction().execute(ctx([sig('s1'), sig('s2')]))).rejects.toThrow(/demand signal/i);
  });
});
