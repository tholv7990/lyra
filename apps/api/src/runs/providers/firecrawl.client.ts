import { Injectable } from '@nestjs/common';

export interface FirecrawlResult {
  ok: boolean;
  html?: string;
  markdown?: string;
  title?: string;
  description?: string;
  statusCode?: number;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    html?: string;
    markdown?: string;
    metadata?: { title?: string | string[]; description?: string | string[]; statusCode?: number };
  };
  error?: string;
}

const first = (v?: string | string[]): string | undefined => (Array.isArray(v) ? v[0] : v);

// Firecrawl v2 scrape backend (BYO key). One REST call; full-page html (onlyMainContent
// false) so the crawl provider's existing extractors work as on a direct fetch. Never
// throws — returns { ok:false } so the caller degrades. Fixed host → no SSRF concern.
@Injectable()
export class FirecrawlClient {
  async scrape(url: string, apiKey: string): Promise<FirecrawlResult> {
    try {
      const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ url, formats: [{ type: 'html' }], onlyMainContent: false }),
      });
      const body = (await res.json().catch(() => ({}))) as FirecrawlScrapeResponse;
      if (!res.ok || !body.success || !body.data) return { ok: false };
      const d = body.data;
      return {
        ok: true,
        html: d.html,
        markdown: d.markdown,
        title: first(d.metadata?.title),
        description: first(d.metadata?.description),
        statusCode: d.metadata?.statusCode,
      };
    } catch {
      return { ok: false };
    }
  }
}
