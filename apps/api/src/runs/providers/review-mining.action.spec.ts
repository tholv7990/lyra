import { ReviewMiningAction } from './review-mining.action';
import { Provider } from '@lyra/shared';
const ctx = () => ({ action: { type: 'review-mining' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'product breaks after a week', kind: 'verified', sourceId: 's1' }], sources: [], data: {}, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
describe('ReviewMiningAction', () => {
  it('parses review fields', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: '{"complaints":["breaks quickly"],"desiredFeatures":["longer warranty"],"objections":["too expensive"]}' }) };
    const out = await new ReviewMiningAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).reviewMining.complaints[0]).toBe('breaks quickly');
  });
  it('degrades to empty arrays on bad JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'x' }) };
    const out = await new ReviewMiningAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).reviewMining).toEqual({ complaints: [], desiredFeatures: [], objections: [] });
  });
});
