import { CreativePotentialAction } from './creative-potential.action';
import { Provider } from '@lyra/shared';
const ctx = () => ({ action: { type: 'creative-potential' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'parents love unboxing videos', kind: 'verified', sourceId: 's1' }], sources: [], data: {}, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
describe('CreativePotentialAction', () => {
  it('parses creative concepts', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: '{"concepts":[{"hook":"kids love it","angle":"unboxing moment"}]}' }) };
    const out = await new CreativePotentialAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).creativeConcepts[0].hook).toBe('kids love it');
  });
  it('degrades to empty array on bad JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'x' }) };
    const out = await new CreativePotentialAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).creativeConcepts).toEqual([]);
  });
});
