import { Injectable } from '@nestjs/common';
import { ApifyClient } from './apify.client';

const SEARCH_ACTOR = process.env.APIFY_META_SEARCH_ACTOR ?? 'apify/facebook-ads-scraper';
const ADS_ACTOR = process.env.APIFY_META_ADS_ACTOR ?? 'apify/facebook-ads-scraper';

const domainOf = (url?: string): string | undefined => {
  if (!url) return undefined;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return undefined; }
};

interface Row {
  adArchiveID?: string | number; ad_archive_id?: string | number;
  pageID?: string; pageId?: string; pageName?: string; page_name?: string;
  snapshot?: { videos?: { video_hd_url?: string; video_sd_url?: string }[]; images?: { original_image_url?: string }[];
    body?: { text?: string }; link_url?: string };
}

@Injectable()
export class MetaCollector {
  constructor(private readonly apify: ApifyClient) {}

  async crawlAds(pageId: string, token: string) {
    const rows = (await this.apify.runActor(ADS_ACTOR, { pageIds: [pageId], activeStatus: 'active', count: 200 }, token)) as Row[];
    return rows
      .map((r) => {
        const adId = String(r.adArchiveID ?? r.ad_archive_id ?? '');
        const vid = r.snapshot?.videos?.[0]?.video_hd_url ?? r.snapshot?.videos?.[0]?.video_sd_url;
        const img = r.snapshot?.images?.[0]?.original_image_url;
        return { adId, creativeUrl: vid ?? img, copy: r.snapshot?.body?.text, format: vid ? 'video' : img ? 'image' : 'unknown' };
      })
      .filter((a) => a.adId);
  }

  async searchAdvertisers(keywords: string[], token: string) {
    const rows = (await this.apify.runActor(SEARCH_ACTOR, { searchTerms: keywords, activeStatus: 'active', count: 100 }, token)) as Row[];
    const seen = new Set<string>();
    const out: { pageId?: string; pageName: string; domain?: string }[] = [];
    for (const r of rows) {
      const pageId = r.pageID ?? r.pageId;
      const pageName = r.pageName ?? r.page_name;
      if (!pageName || (pageId && seen.has(pageId))) continue;
      if (pageId) seen.add(pageId);
      out.push({ pageId, pageName, domain: domainOf(r.snapshot?.link_url) });
    }
    return out;
  }
}
