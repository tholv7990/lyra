import { CustomerJobAction } from './customer-job.action';
import { Provider } from '@lyra/shared';
const ctx = () => ({ action: { type: 'customer-job' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'busy parents buy it', kind: 'verified', sourceId: 's1' }], sources: [], data: {}, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
describe('CustomerJobAction', () => {
  it('parses the JTBD', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: '{"customer":"busy parents","job":"keep kids busy","problem":"boredom","alternative":"TV","trigger":"rainy day"}' }) };
    const out = await new CustomerJobAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).customerJob.customer).toBe('busy parents');
  });
  it('degrades to empty on bad JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'x' }) };
    const out = await new CustomerJobAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).customerJob).toEqual({ customer: '', job: '', problem: '', alternative: '', trigger: '' });
  });
});
