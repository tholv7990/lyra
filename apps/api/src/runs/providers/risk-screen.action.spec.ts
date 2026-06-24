import { RiskScreenAction } from './risk-screen.action';
import { Provider } from '@lyra/shared';

const ctx = () => ({ action: { type: 'risk-screen' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'Mickey Mouse plush toy', kind: 'verified', sourceId: 's1' }], sources: [], data: {}, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };

describe('RiskScreenAction', () => {
  it('parses risk flags + notes from the LLM JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: '{"materialIpRisk":true,"unresolvedSafety":false,"misleadingClaimsRequired":false,"riskNotes":["Branded character — IP risk"]}' }) };
    const out = await new RiskScreenAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).riskFlags.materialIpRisk).toBe(true);
    expect((out.data as any).riskFlags.unresolvedSafety).toBe(false);
    expect((out.data as any).riskNotes[0]).toMatch(/IP risk/);
  });
  it('marks "could not screen" on bad JSON (no throw, no false-clean)', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'not json' }) };
    const out = await new RiskScreenAction(client as never, client as never, keys as never).execute(ctx());
    expect((out.data as any).riskFlags).toEqual({ unresolvedSafety: false, materialIpRisk: false, misleadingClaimsRequired: false });
    expect((out.data as any).riskNotes).toHaveLength(1);
    expect((out.data as any).riskNotes[0]).toMatch(/could not screen/i);
    expect(out.result).toMatch(/could not screen/i);
  });
});
