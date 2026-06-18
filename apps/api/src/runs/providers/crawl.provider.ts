import { Injectable } from '@nestjs/common';
import type {
  StepAssetOutput,
  StepProvider,
  StepRunContext,
  StepRunOutput,
} from './step-provider.interface';

// Source step: fetch a URL (taken from the step's prompt) and extract the page's
// product images + title/description. No API key. The primary image is returned
// as an asset; a markdown summary (title · description · image URLs) is the
// result, so a downstream step (e.g. a ChatGPT branding step) consumes it via
// {input}. This is the first "Source" connector of the dropshipping autopilot.
@Injectable()
export class CrawlStepProvider implements StepProvider {
  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    const url = firstUrl(ctx.step.prompt);
    if (!url) {
      throw new Error(
        'Crawl step: no URL found in the prompt. Include the page URL (e.g. the {homepage} variable).',
      );
    }

    let html: string;
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (LyraCrawler)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      throw new Error(`Crawl failed for ${url}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    const title = metaProp(html, 'og:title') ?? tag(html, /<title[^>]*>([^<]+)<\/title>/i) ?? url;
    const description = metaProp(html, 'og:description') ?? metaName(html, 'description') ?? '';
    const ogImage = httpsify(absolutize(metaProp(html, 'og:image'), url));
    const images = extractImages(html);
    const primary = ogImage ?? images[0];

    const result = [
      `# Crawled: ${decode(title)}`,
      '',
      `**Source:** ${url}`,
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
function metaProp(html: string, prop: string): string | null {
  const a = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i');
  return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null;
}
function metaName(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return html.match(re)?.[1] ?? null;
}
function tag(html: string, re: RegExp): string | null {
  return html.match(re)?.[1]?.trim() ?? null;
}
function absolutize(u: string | null, base: string): string | null {
  if (!u) return null;
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}
function httpsify(u: string | null): string | null {
  return u ? u.replace(/^http:\/\//i, 'https://') : u;
}
function extractImages(html: string): string[] {
  const raw = [
    ...html.matchAll(/https?:\/\/[^"' )<>]+?\.(?:png|jpe?g|webp)(?:\?[^"' )<>]*)?/gi),
  ].map((m) => httpsify(m[0]) as string);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of raw) {
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  const products = out.filter((u) => /cdn\/shop\/(files|products)/i.test(u));
  return products.length ? products : out;
}
function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
