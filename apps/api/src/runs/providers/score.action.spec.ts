import { ScoreAction } from './score.action';
import { Provider, WEIGHTS } from '@lyra/shared';
function make(over: { aiKeys?: Provider[]; llmJson?: string } = {}) {
  const json = over.llmJson ?? JSON.stringify({ subScores: Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, 4])) });
  const anthropic = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const openai = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue((over.aiKeys ?? [Provider.Anthropic]).map((provider) => ({ provider }))), getDecrypted: jest.fn().mockResolvedValue('k') };
  return { action: new ScoreAction(anthropic as never, openai as never, keys as never), anthropic, openai, keys };
}
const ctx = () => ({ action: { type: 'score' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'demand up', kind: 'estimate', sourceId: 's1', demandSignal: true }], sources: [], data: {}, variables: {} } }) as any;
describe('ScoreAction', () => {
  it('writes validated subScores (all WEIGHTS keys, clamped) to data', async () => {
    const { action } = make();
    const out = await action.execute(ctx());
    const ss = (out.data as any).subScores;
    expect(Object.keys(ss).sort()).toEqual(Object.keys(WEIGHTS).sort());
    expect(Math.max(...Object.values(ss).map(Number))).toBeLessThanOrEqual(5);
  });
  it('defaults a missing dimension to 0 (no throw on partial JSON)', async () => {
    const { action } = make({ llmJson: '{"subScores":{"demandIntent":5}}' });
    const out = await action.execute(ctx());
    expect((out.data as any).subScores.demandIntent).toBe(5);
    expect((out.data as any).subScores.whitespace).toBe(0);
  });
  it('uses the OpenAI client when only an OpenAI key is present', async () => {
    const { action, anthropic, openai } = make({ aiKeys: [Provider.OpenAI] });
    await action.execute(ctx());
    expect(openai.complete).toHaveBeenCalled();
    expect(anthropic.complete).not.toHaveBeenCalled();
  });
  it('throws with no AI key', async () => {
    const { action } = make({ aiKeys: [] });
    await expect(action.execute(ctx())).rejects.toThrow(/key/i);
  });
});
