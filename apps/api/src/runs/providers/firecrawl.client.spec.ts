import { FirecrawlClient } from './firecrawl.client';

describe('FirecrawlClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('parses a successful v2 scrape into fields', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { html: '<html>x</html>', markdown: 'x', metadata: { title: ['T'], description: 'D', statusCode: 200 } } }),
    }) as never;
    const r = await new FirecrawlClient().scrape('https://a.com', 'fc-key');
    expect(r).toEqual({ ok: true, html: '<html>x</html>', markdown: 'x', title: 'T', description: 'D', statusCode: 200 });
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://api.firecrawl.dev/v2/scrape');
    expect(call[1].headers.authorization).toBe('Bearer fc-key');
  });

  it('returns {ok:false} on success:false, HTTP error, or thrown fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false, error: 'blocked' }) }) as never;
    expect(await new FirecrawlClient().scrape('https://a.com', 'k')).toEqual({ ok: false });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as never;
    expect(await new FirecrawlClient().scrape('https://a.com', 'k')).toEqual({ ok: false });
    global.fetch = jest.fn().mockRejectedValue(new Error('net')) as never;
    expect(await new FirecrawlClient().scrape('https://a.com', 'k')).toEqual({ ok: false });
  });
});
