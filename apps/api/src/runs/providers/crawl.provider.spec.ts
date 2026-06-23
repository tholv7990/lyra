import { CrawlStepProvider } from './crawl.provider';

const PAGE = '<html><head><meta property="og:title" content="Dog Bed"><meta property="og:image" content="https://img.test/a.jpg"></head><body>' + 'x'.repeat(5000) + '</body></html>';
const ctx = (prompt: string) => ({ step: { prompt }, workspaceId: 'ws', priorResults: [] }) as never;

describe('CrawlStepProvider', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('extracts from a direct fetch when it is usable (no key needed)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => PAGE }) as never;
    const creds = { getDecrypted: jest.fn().mockResolvedValue(null) };
    const firecrawl = { scrape: jest.fn() };
    const out = await new CrawlStepProvider(creds as never, firecrawl as never).execute(ctx('Fetch https://shop.test/p'));
    expect(out.result).toContain('Dog Bed');
    expect(firecrawl.scrape).not.toHaveBeenCalled();
  });

  it('escalates to Firecrawl on a blocked direct fetch when a key is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 202, text: async () => '' }) as never;
    const creds = { getDecrypted: jest.fn().mockResolvedValue('fc-key') };
    const firecrawl = { scrape: jest.fn().mockResolvedValue({ ok: true, html: PAGE }) };
    const out = await new CrawlStepProvider(creds as never, firecrawl as never).execute(ctx('Fetch https://amazon.com/dp/x'));
    expect(firecrawl.scrape).toHaveBeenCalledWith('https://amazon.com/dp/x', 'fc-key');
    expect(out.result).toContain('Dog Bed');
  });

  it('throws a clear error when blocked and no key is set', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 202, text: async () => '' }) as never;
    const creds = { getDecrypted: jest.fn().mockResolvedValue(null) };
    const firecrawl = { scrape: jest.fn() };
    await expect(new CrawlStepProvider(creds as never, firecrawl as never).execute(ctx('Fetch https://amazon.com/dp/x')))
      .rejects.toThrow(/Crawl failed|Firecrawl/i);
  });
});
