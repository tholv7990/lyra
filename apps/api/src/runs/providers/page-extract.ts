// Small, dependency-free HTML extraction helpers shared by the crawl step
// provider and the product-import service. Lifted verbatim from crawl.provider.ts
// (no behavior change) so both reuse one implementation.

// Read an Open Graph / property meta tag (e.g. og:title), tolerant of attribute order.
export function metaProp(html: string, prop: string): string | null {
  const a = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i');
  return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null;
}

// Read a name=… meta tag (e.g. description).
export function metaName(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return html.match(re)?.[1] ?? null;
}

// First capture group of a tag regex, trimmed.
export function tag(html: string, re: RegExp): string | null {
  return html.match(re)?.[1]?.trim() ?? null;
}

// Resolve a possibly-relative URL against a base; returns the input on failure.
export function absolutize(u: string | null, base: string): string | null {
  if (!u) return null;
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}

// Upgrade an http URL to https (leave others untouched).
export function httpsify(u: string | null): string | null {
  return u ? u.replace(/^http:\/\//i, 'https://') : u;
}

// Heuristic: pull image URLs from the HTML, dedupe by URL sans query, https-ify.
// If any Shopify CDN product/file images are present, prefer just those.
export function extractImages(html: string): string[] {
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

// Decode the handful of HTML entities we care about for titles/descriptions.
export function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
