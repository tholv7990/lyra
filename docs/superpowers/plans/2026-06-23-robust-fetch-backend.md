# Plan — Robust fetch backend (Firecrawl default → Apify fallback)

> **Date:** 2026-06-23. **Status:** plan, nothing built.
> **Decision (recorded):** **Firecrawl is the default robust-fetch backend; Apify is the fallback.** Both BYO-key.
> Grounded in a live block-test + a 4-provider cost comparison (Firecrawl / Apify / ScrapFly / Oxylabs).

## Problem (empirically confirmed)

Lyra's naive `crawl` provider ([crawl.provider.ts](../../../apps/api/src/runs/providers/crawl.provider.ts)) does a plain `fetch()` with a `LyraCrawler` user-agent. Live test against the marketplaces (one request each):

| Site | Lyra UA | Real Chrome UA | Verdict |
|---|---|---|---|
| Amazon | 202, **0 bytes** | 202, 0 bytes | 🔴 bot-mitigated, no data |
| Walmart | 200 + **captcha** | 200 + captcha | 🔴 challenge page |
| AliExpress | 200, **2 KB** captcha | 200, 2 KB captcha | 🔴 JS-challenge stub |
| eBay / Alibaba | 200, HTML | 200, HTML | 🟡 loads (JS-heavy) |

**UA made zero difference** → it's IP-reputation + captcha + fingerprint, not a header problem. Lyra's server is a datacenter IP, so it gets the same block in production.

**Scope:** only the **direct marketplace product-page fetch** (the **products-import**) is affected. **Tavily** (research search) and the **yt-dlp crawler** (TikTok/FB/YT video) are fine — they delegate fetching to infra that handles anti-bot / uses cookies. So this is a narrow, low-volume gap.

## Decision — a swappable `FetchBackend`, tiered, Firecrawl-default

Mirrors the existing `SearchBackend` (Tavily→Exa-swappable) pattern. Order, with graceful degradation:

1. **Direct fetch** (existing `crawl.provider`) — simple/Shopify/static sites. Free.
2. **Firecrawl — DEFAULT.** BYO key. **1,000 free pages/mo** (recurring, no card), LLM-ready markdown, one REST call. The default robust backend for blocked / JS / marketplace pages.
3. **Apify — FALLBACK.** BYO key, **already integrated** (the monitor's `ConnectorsProxy`). Hard-target specialist with ready Amazon/AliExpress/Walmart scrapers + structured output. Used when Firecrawl returns a block/thin result.
4. **Manual entry.** If both fail, the user pastes/edits the product fields (which they review anyway). **Never hard-fail an import.**

`direct → Firecrawl → Apify → manual`

### Why Firecrawl default, Apify fallback
- **Firecrawl is cheapest** (1,000 free pages/mo, no card → effectively **$0** for a dropshipper's low, human-reviewed volume), LLM-ready markdown (easy field extraction), simplest integration (one key, REST).
- **Apify fallback** is already wired and is a hard-target specialist (ready marketplace scrapers, structured output) — the right escalation when Firecrawl can't crack a specific site.
- Both are **BYO-key → Lyra pays nothing** (inv. 7). Results are **cached** (reuse the per-step cache) so a page is fetched once.
- **Not chosen now:** ScrapFly / Oxylabs (peers, but pricier ongoing — Oxylabs has no recurring free tier, $49/mo floor; ScrapFly's free credits burn ~30/req on hard sites). ScrapFly's open-source **parsers** (AliExpress/Amazon/eBay) are useful *reference* for field extraction regardless of backend.

## Where it plugs in
- **Products-import** (paste AliExpress/Amazon link → product fields): route through `FetchBackend`. Firecrawl markdown → extract the lean fields (title · images · category · price/compareAt · offer); Apify → structured data directly.
- Optionally the **research provider's single-URL fetch** (the grounding fetch that today uses the naive `crawl`) — same backend, so research grounding also stops failing on protected pages.
- **Not** the video crawler (yt-dlp is fine) or Tavily search (fine).

## Architecture
- `FetchBackend` interface: `fetch(url, opts) → { markdown?, html?, structured?, status }`. Impls: `DirectFetch`, `FirecrawlBackend`, `ApifyBackend`.
- **Home: extend the existing connectors-service** — it already owns external fetching, BYO encrypted creds, async download-jobs, and `ConnectorsProxy`. Add a "fetch page" capability beside the yt-dlp video path; reuse the patterns.
- BYO Firecrawl/Apify keys **encrypted per-workspace** like Tavily / connector creds. Workspace-scoped queries (inv. 5).
- Graceful degradation in code + a clear **"couldn't fetch automatically — enter manually"** affordance in the products-import UI.

## Cost (BYO-key; Lyra pays $0)
- Default Firecrawl: 1,000 free pages/mo → $0 at typical volume.
- Fallback Apify: free $5/cycle + cheap residential at low volume.
- Cache aggressively; low-volume + human-reviewed keeps it near-free for the user.

## Scope cuts / non-goals
- **Don't self-host a scraper** — it won't beat marketplace IP/captcha without paid residential proxies anyway.
- **Don't add ScrapFly/Oxylabs** now (Firecrawl + Apify cover it; revisit only if a site neither can crack appears).
- No new infra beyond the `FetchBackend` + the two BYO clients.

## Invariants
BYO per-workspace **encrypted** keys (inv. 7) · workspace-scoped (inv. 5) · swappable backend = one-line registry change (inv. 9) · `@lyra/shared` zero runtime deps (inv. 1) · never hard-fail an import — degrade to manual.
