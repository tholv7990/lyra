import { TavilyClient } from './tavily.client';

describe('TavilyClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('maps a Tavily response to SearchHit[] and sends the key', async () => {
    const seen: { url: string; body: string } = { url: '', body: '' };
    global.fetch = (async (url: string, init: RequestInit) => {
      seen.url = url; seen.body = String(init.body);
      return { ok: true, json: async () => ({ results: [
        { title: 'T1', url: 'https://a.com', content: 'c1', published_date: '2026-01-01', score: 0.9 },
        { title: 'T2', url: 'https://b.com', content: 'c2' },
      ] }) };
    }) as unknown as typeof fetch;

    const hits = await new TavilyClient().search('trending dog toys', { apiKey: 'tvly-x', maxResults: 5 });
    expect(hits).toEqual([
      { title: 'T1', url: 'https://a.com', content: 'c1', publishedDate: '2026-01-01', score: 0.9 },
      { title: 'T2', url: 'https://b.com', content: 'c2', publishedDate: undefined, score: undefined },
    ]);
    expect(seen.body).toContain('"api_key":"tvly-x"');
    expect(seen.body).toContain('"include_raw_content"');
    expect(seen.body).toContain('"max_results":5');
  });

  it('throws a clear error on a non-ok response', async () => {
    global.fetch = (async () => ({ ok: false, status: 401, json: async () => ({ error: 'bad key' }) })) as unknown as typeof fetch;
    await expect(new TavilyClient().search('q', { apiKey: 'x', maxResults: 3 })).rejects.toThrow(/bad key|401/);
  });
});
