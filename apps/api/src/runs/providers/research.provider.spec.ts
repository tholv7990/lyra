import { ResearchStepProvider } from './research.provider';
import { Provider } from '@lyra/shared';

function make(over: { tavilyKey?: string | null; aiKeys?: Provider[]; hits?: any[] } = {}) {
  const tavily = { search: jest.fn().mockResolvedValue(over.hits ?? [{ title: 'A', url: 'https://a.com', content: 'dog toys trending up' }]) };
  const anthropic = { complete: jest.fn().mockImplementation(async ({ system }: { system: string }) => ({
    text: system.includes('PLAN') ? '{"queries":["q"]}'
      : system.includes('EXTRACT') ? '{"claims":[{"statement":"demand up","kind":"estimate","sourceId":"s1","quote":"dog toys trending up","demandSignal":true}]}'
      : '{"enough":true,"followupQueries":[]}',
  })) };
  const openai = { complete: jest.fn().mockImplementation(async ({ system }: { system: string }) => ({
    text: system.includes('PLAN') ? '{"queries":["q"]}'
      : system.includes('EXTRACT') ? '{"claims":[{"statement":"demand up","kind":"estimate","sourceId":"s1","quote":"dog toys trending up","demandSignal":true}]}'
      : '{"enough":true,"followupQueries":[]}',
  })) };
  const creds = { getDecrypted: jest.fn().mockResolvedValue(over.tavilyKey === undefined ? 'tvly-k' : over.tavilyKey) };
  const keys = {
    list: jest.fn().mockResolvedValue((over.aiKeys ?? [Provider.Anthropic]).map((provider) => ({ provider }))),
    getDecrypted: jest.fn().mockResolvedValue('ai-k'),
  };
  const provider = new ResearchStepProvider(tavily as never, anthropic as never, openai as never, creds as never, keys as never);
  return { provider, tavily, anthropic, openai, creds, keys };
}
const ctx = (prompt = 'Is X trending?') => ({ step: { prompt } as never, apiKey: '', priorResults: [], workspaceId: 'ws' });

describe('ResearchStepProvider', () => {
  it('errors clearly when no Tavily key', async () => {
    const { provider } = make({ tavilyKey: null });
    await expect(provider.execute(ctx() as never)).rejects.toThrow(/tavily/i);
  });
  it('errors clearly when no AI key at all', async () => {
    const { provider } = make({ aiKeys: [] });
    await expect(provider.execute(ctx() as never)).rejects.toThrow(/key/i);
  });
  it('returns grounded evidence + sources; result summarizes; resolves the tavily key for the workspace', async () => {
    const { provider, tavily, creds } = make();
    const out = await provider.execute(ctx() as never);
    expect(creds.getDecrypted).toHaveBeenCalledWith('ws', 'tavily');
    expect(tavily.search).toHaveBeenCalled();
    expect(out.sources!.length).toBeGreaterThan(0);
    expect(out.evidence!.every((c) => out.sources!.some((s) => s.id === c.sourceId))).toBe(true);
    expect(typeof out.result).toBe('string');
  });
  it('uses OpenAI client (not Anthropic) when only an OpenAI key is present', async () => {
    const { provider, anthropic, openai, tavily } = make({ aiKeys: [Provider.OpenAI] });
    const out = await provider.execute(ctx() as never);
    expect(tavily.search).toHaveBeenCalled();
    expect(openai.complete).toHaveBeenCalled();
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(out.sources!.length).toBeGreaterThan(0);
    expect(typeof out.result).toBe('string');
  });
});
