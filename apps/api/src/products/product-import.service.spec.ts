// Mock node:dns/promises so safeFetchFollow (used by fetchPage's directFetch)
// resolves test hostnames to a public IP — no real DNS, fully deterministic.
jest.mock('node:dns/promises', () => ({ lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]) }));

import { BadRequestException } from '@nestjs/common';
import { Provider } from '@lyra/shared';
import { ProductImportService, detectPlatform, parseLlmJson, mergeImages } from './product-import.service';

// A "real" product page: > MIN_USABLE_BYTES (4096) so the direct fetch is used
// (not treated as blocked/thin) and the crawl helpers find og tags + images.
const PAGE =
  '<html><head>' +
  '<meta property="og:title" content="Dog Bed">' +
  '<meta property="og:description" content="A comfy bed">' +
  '<meta property="og:image" content="https://img.test/og.jpg">' +
  '</head><body>' +
  '<img src="https://img.test/crawl1.png"> <img src="https://img.test/crawl2.jpg">' +
  'x'.repeat(5000) +
  '</body></html>';

// A direct fetch that succeeds with PAGE. safeFetchFollow reads status/headers/ok/text.
function fetchOk(body = PAGE) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => body,
  }) as never;
}

interface MakeOpts {
  aiKeys?: Provider[];
  firecrawlKey?: string | null;
  llmText?: string;
  anthropicThrows?: boolean;
}

function make(over: MakeOpts = {}) {
  const creds = { getDecrypted: jest.fn().mockResolvedValue(over.firecrawlKey ?? null) };
  const keys = {
    list: jest.fn().mockResolvedValue((over.aiKeys ?? [Provider.Anthropic]).map((provider) => ({ provider }))),
    getDecrypted: jest.fn().mockResolvedValue('ai-key'),
  };
  const llmText = over.llmText ?? '{"name":"Dog Bed","price":89,"images":["https://img.test/llm1.jpg"]}';
  const anthropic = {
    complete: over.anthropicThrows
      ? jest.fn().mockRejectedValue(new Error('provider down'))
      : jest.fn().mockResolvedValue({ text: llmText }),
  };
  const openai = { complete: jest.fn().mockResolvedValue({ text: llmText }) };
  const firecrawl = { scrape: jest.fn().mockResolvedValue({ ok: true, html: PAGE }) };
  const svc = new ProductImportService(creds as never, keys as never, firecrawl as never, anthropic as never, openai as never);
  return { svc, creds, keys, anthropic, openai, firecrawl };
}

describe('ProductImportService.extractFromUrl', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('detects the platform from the host and sets source', async () => {
    global.fetch = fetchOk();
    const { svc } = make();
    const out = await svc.extractFromUrl('ws', 'https://www.amazon.com/dp/X');
    expect(out.source).toEqual({ url: 'https://www.amazon.com/dp/X', platform: 'amazon' });
  });

  it('parses LLM JSON wrapped in ```json fences', async () => {
    global.fetch = fetchOk();
    const { svc } = make({ llmText: '```json\n{"name":"Fenced Bed","price":42}\n```' });
    const out = await svc.extractFromUrl('ws', 'https://shop.test/p');
    expect(out.name).toBe('Fenced Bed');
    expect(out.price).toBe(42);
  });

  it('merges + dedupes LLM and crawl images and caps at 10', async () => {
    global.fetch = fetchOk();
    const many = Array.from({ length: 14 }, (_, i) => `https://img.test/x${i}.jpg`);
    const { svc } = make({ llmText: JSON.stringify({ name: 'X', images: many }) });
    const out = await svc.extractFromUrl('ws', 'https://shop.test/p');
    expect(out.images!.length).toBe(10);
    // dedupe by URL sans query: no duplicate base URLs
    const bases = out.images!.map((u) => u.split('?')[0]);
    expect(new Set(bases).size).toBe(bases.length);
  });

  it('coerces price strings ($89.00 → 89) and drops empty/invalid prices', async () => {
    global.fetch = fetchOk();
    const { svc } = make({ llmText: '{"name":"P","price":"$89.00","compareAtPrice":""}' });
    const out = await svc.extractFromUrl('ws', 'https://shop.test/p');
    expect(out.price).toBe(89);
    expect(out.compareAtPrice).toBeUndefined();
  });

  it('returns crawl-only fields + a warning when the LLM output is unparseable (no throw)', async () => {
    global.fetch = fetchOk();
    const { svc } = make({ llmText: 'sorry, I cannot do that' });
    const out = await svc.extractFromUrl('ws', 'https://shop.test/p');
    expect(out.name).toBe('Dog Bed'); // from og:title
    expect(out.warnings && out.warnings.length).toBeTruthy();
    expect(out.images!.length).toBeGreaterThan(0); // og:image + crawl images
  });

  it('degrades to crawl-only when the LLM call throws (no hard failure)', async () => {
    global.fetch = fetchOk();
    const { svc } = make({ anthropicThrows: true });
    const out = await svc.extractFromUrl('ws', 'https://shop.test/p');
    expect(out.name).toBe('Dog Bed');
    expect(out.warnings && out.warnings.length).toBeTruthy();
  });

  it('throws BadRequestException when no AI provider key is present', async () => {
    global.fetch = fetchOk();
    const { svc } = make({ aiKeys: [] });
    await expect(svc.extractFromUrl('ws', 'https://shop.test/p')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the page cannot be read (blocked, no Firecrawl key)', async () => {
    // A thin/blocked direct fetch (empty body) with no Firecrawl key → no html.
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 202, headers: { get: () => null }, text: async () => '' }) as never;
    const { svc } = make({ firecrawlKey: null });
    await expect(svc.extractFromUrl('ws', 'https://amazon.com/dp/x')).rejects.toThrow(BadRequestException);
  });

  it('uses the OpenAI client (not Anthropic) when only an OpenAI key is present', async () => {
    global.fetch = fetchOk();
    const { svc, openai, anthropic } = make({ aiKeys: [Provider.OpenAI] });
    await svc.extractFromUrl('ws', 'https://shop.test/p');
    expect(openai.complete).toHaveBeenCalled();
    expect(anthropic.complete).not.toHaveBeenCalled();
  });
});

describe('ProductImportService pure helpers', () => {
  it('detectPlatform maps known hosts and falls back to the bare hostname', () => {
    expect(detectPlatform('https://www.amazon.com/dp/x')).toBe('amazon');
    expect(detectPlatform('https://aliexpress.com/item/1')).toBe('aliexpress');
    expect(detectPlatform('https://www.walmart.com/ip/1')).toBe('walmart');
    expect(detectPlatform('https://shop.example.com/p')).toBe('shop.example.com');
    expect(detectPlatform('not a url')).toBe('unknown');
  });

  it('parseLlmJson strips fences and extracts the first {…last }', () => {
    expect(parseLlmJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLlmJson('Here you go: {"a":1} thanks')).toEqual({ a: 1 });
    expect(parseLlmJson('no json here')).toBeNull();
    expect(parseLlmJson('')).toBeNull();
  });

  it('mergeImages unions, dedupes by URL sans query, https-ifies, caps at 10', () => {
    const out = mergeImages(['http://a.com/1.jpg?x=1', 'http://a.com/1.jpg?y=2'], ['http://b.com/2.jpg']);
    expect(out).toEqual(['https://a.com/1.jpg?x=1', 'https://b.com/2.jpg']);
  });
});
