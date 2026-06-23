import { fetchPage, isBlockedOrThin } from './fetch-page';

const big = 'x'.repeat(5000); // > 4096 → usable

describe('isBlockedOrThin', () => {
  it('flags non-2xx, thin, and captcha bodies; passes a real page', () => {
    expect(isBlockedOrThin({ ok: false, status: 403, body: big })).toBe(true);
    expect(isBlockedOrThin({ ok: true, status: 202, body: '' })).toBe(true);
    expect(isBlockedOrThin({ ok: true, status: 200, body: 'tiny' })).toBe(true);
    expect(isBlockedOrThin({ ok: true, status: 200, body: 'PX-CAPTCHA ' + big })).toBe(true);
    expect(isBlockedOrThin({ ok: true, status: 200, body: big })).toBe(false);
  });
});

describe('fetchPage', () => {
  const fcOk = async () => ({ ok: true, html: '<html>fc</html>', markdown: 'fc' });
  const fcFail = async () => ({ ok: false });

  it('uses direct when usable, never calls Firecrawl', async () => {
    const fc = jest.fn(fcOk);
    const r = await fetchPage('https://a.com', { firecrawlKey: 'k', directFetch: async () => ({ ok: true, status: 200, body: big }), firecrawlScrape: fc });
    expect(r).toEqual({ html: big, source: 'direct' });
    expect(fc).not.toHaveBeenCalled();
  });

  it('escalates to Firecrawl on a thin direct when a key is present', async () => {
    const r = await fetchPage('https://a.com', { firecrawlKey: 'k', directFetch: async () => ({ ok: true, status: 200, body: 'tiny' }), firecrawlScrape: fcOk });
    expect(r).toEqual({ html: '<html>fc</html>', markdown: 'fc', source: 'firecrawl' });
  });

  it('does NOT escalate without a key (degrades)', async () => {
    const fc = jest.fn(fcOk);
    const r = await fetchPage('https://a.com', { firecrawlKey: null, directFetch: async () => ({ ok: false, status: 403, body: '' }), firecrawlScrape: fc });
    expect(fc).not.toHaveBeenCalled();
    expect(r).toEqual({ html: '', source: 'none' });
  });

  it('degrades to direct body when Firecrawl also fails', async () => {
    const r = await fetchPage('https://a.com', { firecrawlKey: 'k', directFetch: async () => ({ ok: true, status: 200, body: 'tiny' }), firecrawlScrape: fcFail });
    expect(r).toEqual({ html: 'tiny', source: 'direct' });
  });
});
