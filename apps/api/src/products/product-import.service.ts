import { BadRequestException, Injectable } from '@nestjs/common';
import { defaultModel, Provider, TEXT_FALLBACK_ORDER } from '@lyra/shared';
import type { ImportedProduct, ProductSource } from '@lyra/shared';
import { ConnectorCredentialsService } from '../connectors/connector-credentials.service';
import { KeysService } from '../keys/keys.service';
import { FirecrawlClient } from '../runs/providers/firecrawl.client';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from '../runs/providers/openai-compat.client';
import { fetchPage } from '../runs/providers/fetch-page';
import { metaProp, metaName, extractImages, httpsify, absolutize, decode } from '../runs/providers/page-extract';
import { safeFetchFollow } from '../common/safe-fetch';

// Truncate the page text before sending to the LLM — a token budget guard so a
// huge product page can't blow the input. ~24k chars ≈ a generous product page.
const MAX_LLM_CHARS = 24000;
const MAX_IMAGES = 10;

// JSON shape the LLM is asked to return (all optional — it omits what's absent).
interface LlmProduct {
  name?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  offer?: unknown;
  niche?: unknown;
  category?: unknown;
  description?: unknown;
  images?: unknown;
}

const SYSTEM_PROMPT = [
  'You extract one product\'s fields from a web page.',
  'Use ONLY the provided page content. Reply with JSON only:',
  '{"name":string,"price":number,"compareAtPrice":number,"offer":string,"niche":string,"category":string,"description":string,"images":string[]}.',
  'Omit any field not clearly present on the page. Never guess or invent values.',
  'price/compareAtPrice are numbers (no currency symbols).',
  'images are absolute image URLs shown on the page.',
].join(' ');

// Crawl an e-commerce product URL + LLM-map it into our Product fields. Returns
// an UNSAVED ImportedProduct for the Add-product form to prefill — nothing is
// persisted here. Reuses the run engine's fetch (direct→Firecrawl, SSRF-safe)
// and the workspace's text LLM key (Anthropic→OpenAI→DeepSeek). The clients are
// zero-dependency classes provided standalone in ProductsModule (no RunsModule).
@Injectable()
export class ProductImportService {
  constructor(
    private readonly creds: ConnectorCredentialsService,
    private readonly keys: KeysService,
    private readonly firecrawl: FirecrawlClient,
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
  ) {}

  async extractFromUrl(workspaceId: string, url: string): Promise<ImportedProduct> {
    const ws = workspaceId;
    const source: ProductSource = { url, platform: detectPlatform(url) };

    // 1 · Fetch (direct → Firecrawl on bot-block/thin), SSRF-hardened.
    const firecrawlKey = await this.creds.getDecrypted(ws, 'firecrawl');
    const page = await fetchPage(url, {
      firecrawlKey,
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
      throw new BadRequestException(
        'Could not read the page — it may be bot-blocked. Add a Firecrawl key in Connections, or fill the fields manually.',
      );
    }

    const html = page.html;
    // Crawl-derived fallbacks (used directly on LLM-parse failure, merged otherwise).
    const ogTitle = metaProp(html, 'og:title');
    const ogDescription = metaProp(html, 'og:description') ?? metaName(html, 'description');
    const crawlImages = mergeImages(extractImages(html), []);
    const ogImage = httpsify(absolutize(metaProp(html, 'og:image'), url));
    const fallbackImages = mergeImages(ogImage ? [ogImage] : [], crawlImages);

    // 2 · Resolve a text LLM key (fallback order). None → can't map.
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) {
      throw new BadRequestException(
        'Importing needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.',
      );
    }
    const aiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);

    // 3 · LLM map. Build the input from markdown if present, else HTML, truncated.
    const pageText = (page.markdown ?? html).slice(0, MAX_LLM_CHARS);
    const prompt = `Page URL: ${url}\n\nPage content:\n${pageText}`;
    let llmText = '';
    try {
      if (aiProvider === Provider.Anthropic) {
        llmText = (await this.anthropic.complete({ apiKey: aiKey, model, system: SYSTEM_PROMPT, prompt, maxTokens: 2048 })).text;
      } else {
        const baseUrl = compatBaseUrl(aiProvider) ?? '';
        llmText = (await this.openai.complete({ baseUrl, provider: aiProvider, apiKey: aiKey, model, system: SYSTEM_PROMPT, prompt, maxTokens: 2048 })).text;
      }
    } catch {
      // Provider error mid-import shouldn't block manual entry — degrade to crawl-only.
      llmText = '';
    }

    const parsed = parseLlmJson(llmText);
    if (!parsed) {
      // 4a · Parse failure → crawl-only fields + a warning (no throw, partial).
      return clean({
        name: ogTitle ? decode(ogTitle) : undefined,
        description: ogDescription ? decode(ogDescription) : undefined,
        images: fallbackImages,
        source,
        warnings: ["Couldn't auto-read every field — please review."],
      });
    }

    // 4b · Merge LLM fields with crawl fallbacks.
    const llmImages = Array.isArray(parsed.images)
      ? parsed.images.filter((x): x is string => typeof x === 'string')
      : [];
    return clean({
      name: str(parsed.name) ?? (ogTitle ? decode(ogTitle) : undefined),
      description: str(parsed.description) ?? (ogDescription ? decode(ogDescription) : undefined),
      price: num(parsed.price),
      compareAtPrice: num(parsed.compareAtPrice),
      offer: str(parsed.offer),
      niche: str(parsed.niche),
      category: str(parsed.category),
      images: mergeImages(llmImages, crawlImages),
      source,
    });
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────

export function detectPlatform(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (host.includes('aliexpress')) return 'aliexpress';
  if (host.includes('amazon')) return 'amazon';
  if (host.includes('walmart')) return 'walmart';
  return host.replace(/^www\./, '');
}

// Strip ```json fences/backticks, take the first { … last }, JSON.parse in try/catch.
export function parseLlmJson(text: string): LlmProduct | null {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  s = s.slice(start, end + 1);
  try {
    const obj = JSON.parse(s);
    return obj && typeof obj === 'object' ? (obj as LlmProduct) : null;
  } catch {
    return null;
  }
}

// Coerce to a positive finite number (strip currency symbols/commas) or undefined.
function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Trim a string; undefined when absent/empty.
function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

// Union two image lists, https-ify, dedupe by URL sans query, cap at MAX_IMAGES.
export function mergeImages(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...primary, ...secondary]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const u = httpsify(raw.trim()) as string;
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

// Clamp a string to the matching CreateProduct DTO MaxLength, so the prefill
// payload is bounded and can never exceed what the save endpoint accepts.
function cap(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

// Drop empty/absent fields so the form only prefills what we actually found,
// and clamp string lengths to the create-DTO limits (defence-in-depth).
function clean(p: ImportedProduct): ImportedProduct {
  const out: ImportedProduct = { source: p.source };
  if (p.name) out.name = cap(p.name, 160);
  if (p.description) out.description = cap(p.description, 4000);
  if (p.price !== undefined) out.price = p.price;
  if (p.compareAtPrice !== undefined) out.compareAtPrice = p.compareAtPrice;
  if (p.offer) out.offer = cap(p.offer, 2000);
  if (p.niche) out.niche = cap(p.niche, 120);
  if (p.category) out.category = cap(p.category, 120);
  if (p.images && p.images.length) out.images = p.images;
  if (p.warnings && p.warnings.length) out.warnings = p.warnings;
  return out;
}
