import { SupplyChainAction } from './supply-chain.action';
import { Provider } from '@lyra/shared';
const ctx = () => ({ action: { type: 'supply-chain' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'sourced from Alibaba suppliers', kind: 'verified', sourceId: 's1' }], sources: [], data: {}, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
describe('SupplyChainAction', () => {
  it('parses supply chain fields', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: '{"suppliers":["Alibaba vendor"],"moq":"100 units","leadTime":"30 days","certs":["CE"],"notes":["unverified MOQ"]}' }) };
    const out = await new SupplyChainAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).supplyChain.suppliers[0]).toBe('Alibaba vendor');
  });
  it('degrades to empty structure on bad JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'x' }) };
    const out = await new SupplyChainAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).supplyChain).toEqual({ suppliers: [], certs: [], notes: [] });
  });
});
