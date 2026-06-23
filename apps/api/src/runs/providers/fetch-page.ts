export interface DirectResult { ok: boolean; status: number; body: string; }
export interface FetchPageResult { html: string; markdown?: string; source: 'direct' | 'firecrawl' | 'none'; }
export interface FetchPageDeps {
  firecrawlKey?: string | null;
  directFetch: (url: string) => Promise<DirectResult>;
  firecrawlScrape: (url: string, key: string) => Promise<{ ok: boolean; html?: string; markdown?: string }>;
}

const MIN_USABLE_BYTES = 4096; // a real product page is >>4KB; a captcha/stub is ~0–2KB
const CAPTCHA_RE = /captcha|robot check|px-captcha|are you a human|enable javascript and cookies/i;

// These marketplaces return HTTP 200 with garbage, so status alone is not enough.
export function isBlockedOrThin(r: DirectResult): boolean {
  if (!r.ok || r.status < 200 || r.status >= 300) return true;
  if (r.body.length < MIN_USABLE_BYTES) return true;
  return CAPTCHA_RE.test(r.body);
}

// direct → Firecrawl escalation, pure over injected effects. Direct is free + fine for
// static/Shopify pages; Firecrawl runs only when direct is blocked/thin AND a key exists.
export async function fetchPage(url: string, deps: FetchPageDeps): Promise<FetchPageResult> {
  const direct = await deps.directFetch(url);
  if (!isBlockedOrThin(direct)) return { html: direct.body, source: 'direct' };
  if (deps.firecrawlKey) {
    const fc = await deps.firecrawlScrape(url, deps.firecrawlKey);
    if (fc.ok && (fc.html || fc.markdown)) return { html: fc.html ?? '', markdown: fc.markdown, source: 'firecrawl' };
  }
  return { html: direct.body, source: direct.body ? 'direct' : 'none' };
}
