import { runResearch, type ResearchDeps } from './research.agent';
import type { SearchHit } from './tavily.client';

const caps = { maxRounds: 2, maxSearchesPerRound: 3, maxSources: 12, maxLlmCalls: 6 };
const hit = (url: string, content = 'c'): SearchHit => ({ title: url, url, content });

function makeLlm(scripts: { plan: string; extract: string[]; reflect: string[] }) {
  let ext = 0, ref = 0;
  return async (system: string) => {
    if (system.includes('PLAN')) return scripts.plan;
    if (system.includes('EXTRACT')) return scripts.extract[ext++] ?? '{"claims":[]}';
    if (system.includes('REFLECT')) return scripts.reflect[ref++] ?? '{"enough":true,"followupQueries":[]}';
    return '{}';
  };
}

it('drops a claim that cites an unknown sourceId (anti-hallucination)', async () => {
  const deps: ResearchDeps = {
    search: async () => [hit('https://a.com')],
    llm: makeLlm({
      plan: '{"queries":["q1"]}',
      extract: ['{"claims":[{"statement":"real","kind":"estimate","sourceId":"s1"},{"statement":"fake","kind":"estimate","sourceId":"s999"}]}'],
      reflect: ['{"enough":true,"followupQueries":[]}'],
    }),
    checkAlive: async () => true,
    caps,
  };
  const r = await runResearch('is X trending?', deps);
  expect(r.claims.map((c) => c.statement)).toEqual(['real']);
  expect(r.droppedClaims).toBe(1);
  expect(r.claims[0].sourceId).toBe(r.sources[0].id);
});

it('stamps accessDate + sweeps dead links', async () => {
  const deps: ResearchDeps = {
    search: async () => [hit('https://a.com'), hit('https://dead.com')],
    llm: makeLlm({ plan: '{"queries":["q1"]}', extract: ['{"claims":[]}'], reflect: ['{"enough":true,"followupQueries":[]}'] }),
    checkAlive: async (url) => !url.includes('dead'),
    caps,
  };
  const r = await runResearch('q', deps);
  expect(r.sources).toHaveLength(2);
  expect(r.sources.every((s) => /\d{4}-\d{2}-\d{2}T/.test(s.accessDate))).toBe(true);
  expect(r.sources.find((s) => s.url.includes('dead'))!.alive).toBe(false);
  expect(r.sources.find((s) => s.url === 'https://a.com')!.alive).toBe(true);
});

it('reflect says enough → one round only', async () => {
  let searches = 0;
  const deps: ResearchDeps = {
    search: async () => { searches++; return [hit('https://a.com')]; },
    llm: makeLlm({ plan: '{"queries":["q1"]}', extract: ['{"claims":[]}'], reflect: ['{"enough":true,"followupQueries":[]}'] }),
    checkAlive: async () => true,
    caps,
  };
  const r = await runResearch('q', deps);
  expect(r.rounds).toBe(1);
  expect(searches).toBe(1);
});

it('not enough → runs a second round, then stops at maxRounds', async () => {
  let searches = 0;
  const deps: ResearchDeps = {
    search: async (q) => { searches++; return [hit(`https://${q}.com`)]; },
    llm: makeLlm({
      plan: '{"queries":["q1"]}',
      extract: ['{"claims":[]}', '{"claims":[]}'],
      reflect: ['{"enough":false,"followupQueries":["q2"]}', '{"enough":false,"followupQueries":["q3"]}'],
    }),
    checkAlive: async () => true,
    caps,
  };
  const r = await runResearch('q', deps);
  expect(r.rounds).toBe(2);
  expect(searches).toBe(2);
});

it('caps total sources at maxSources', async () => {
  const many = Array.from({ length: 50 }, (_, i) => hit(`https://s${i}.com`));
  const deps: ResearchDeps = {
    search: async () => many,
    llm: makeLlm({ plan: '{"queries":["q1"]}', extract: ['{"claims":[]}'], reflect: ['{"enough":true,"followupQueries":[]}'] }),
    checkAlive: async () => true,
    caps: { ...caps, maxSources: 12 },
  };
  const r = await runResearch('q', deps);
  expect(r.sources.length).toBeLessThanOrEqual(12);
});
