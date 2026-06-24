import { Injectable } from '@nestjs/common';
import type {
  StepAssetOutput,
  StepProvider,
  StepRunContext,
  StepRunOutput,
} from './step-provider.interface';
import { ConnectorCredentialsService } from '../../connectors/connector-credentials.service';
import { FirecrawlClient } from './firecrawl.client';
import { fetchPage } from './fetch-page';
import { safeFetchFollow } from '../../common/safe-fetch';
import { metaProp, metaName, tag, absolutize, httpsify, extractImages, decode } from './page-extract';

// Source step: fetch a URL (from the step's prompt) and extract product images +
// title/description. Direct fetch first (free); if the page is bot-blocked/thin and the
// workspace has a Firecrawl key, escalate to Firecrawl. The primary image is returned as
// an asset; a markdown summary is the result for a downstream {input}.
@Injectable()
export class CrawlStepProvider implements StepProvider {
  constructor(
    private readonly creds: ConnectorCredentialsService,
    private readonly firecrawl: FirecrawlClient,
  ) {}

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    const url = firstUrl(ctx.step.prompt);
    if (!url) {
      throw new Error(
        'Crawl step: no URL found in the prompt. Include the page URL (e.g. the {homepage} variable).',
      );
    }

    const firecrawlKey = await this.creds.getDecrypted(ctx.workspaceId, 'firecrawl');
    const page = await fetchPage(url, {
      firecrawlKey,
      // safeFetchFollow: http(s)-only, blocks private hosts + redirect-to-private (SSRF),
      // follows public redirects, per-request timeout. A block/timeout/network error returns
      // an empty body so fetchPage escalates to Firecrawl instead of hard-failing.
      directFetch: async (u) => {
        try {
          return await safeFetchFollow(u, { headers: { 'user-agent': 'Mozilla/5.0 (LyraCrawler)' } });
        } catch {
          return { ok: false, status: 0, body: '' };
        }
      },
      firecrawlScrape: (u, k) => this.firecrawl.scrape(u, k),
    });

    if (!page.html) {
      throw new Error(`Crawl failed for ${url}: no content (the page may be bot-blocked — add a Firecrawl key in Connections).`);
    }
    const html = page.html;

    const title = metaProp(html, 'og:title') ?? tag(html, /<title[^>]*>([^<]+)<\/title>/i) ?? url;
    const description = metaProp(html, 'og:description') ?? metaName(html, 'description') ?? '';
    const ogImage = httpsify(absolutize(metaProp(html, 'og:image'), url));
    const images = extractImages(html);
    const primary = ogImage ?? images[0];

    const result = [
      `# Crawled: ${decode(title)}`,
      '',
      `**Source:** ${url}${page.source === 'firecrawl' ? ' (via Firecrawl)' : ''}`,
      ...(description ? ['', `**Description:** ${decode(description)}`] : []),
      '',
      `**Images found (${images.length}):**`,
      ...images.slice(0, 8).map((u) => `- ${u}`),
    ].join('\n');

    const assets: StepAssetOutput[] = primary
      ? [{ type: 'image', url: primary, meta: { source: url, role: 'crawled' } }]
      : [];

    return { result, assets, usage: { tokens: 0 } };
  }
}

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)"'<>]+/i);
  return m ? m[0].replace(/[.,]+$/, '') : null;
}
