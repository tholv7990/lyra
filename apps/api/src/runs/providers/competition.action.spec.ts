import { CompetitionAction } from './competition.action';
import { Provider } from '@lyra/shared';

const ctx = () => ({ action: { type: 'competition' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'Acme sells it at $39', kind: 'verified', sourceId: 's1' }], sources: [{ id: 's1', name: 'Acme', url: 'u', accessDate: 'd', primary: false, alive: true }], data: {}, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };

describe('CompetitionAction', () => {
  it('parses competitors + market type from the LLM JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: '{"competitors":[{"name":"Acme","price":"$39"}],"marketType":"dominated"}' }) };
    const out = await new CompetitionAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).competition.competitors[0].name).toBe('Acme');
    expect((out.data as any).competition.marketType).toBe('dominated');
  });
  it('degrades to empty competition on bad JSON (no throw)', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'not json' }) };
    const out = await new CompetitionAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).competition.competitors).toEqual([]);
    expect(['healthy','dominated','commodity','emerging','underserved']).toContain((out.data as any).competition.marketType);
  });
});
