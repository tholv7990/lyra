import { Injectable } from '@nestjs/common';

export interface SearchHit {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  score?: number;
}
export interface SearchBackend {
  search(query: string, opts: { apiKey: string; maxResults: number }): Promise<SearchHit[]>;
}

interface TavilyResult { title?: string; url?: string; content?: string; raw_content?: string; published_date?: string; score?: number; }

// Tavily search backend. POSTs /search with include_raw_content so each result
// carries page content (fewer separate fetches → better grounding). Swappable:
// any SearchBackend (e.g. an ExaClient) can replace it behind the same interface.
@Injectable()
export class TavilyClient implements SearchBackend {
  async search(query: string, opts: { apiKey: string; maxResults: number }): Promise<SearchHit[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: opts.apiKey,
        query,
        max_results: opts.maxResults,
        include_raw_content: true,
        search_depth: 'advanced',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { results?: TavilyResult[]; error?: string };
    if (!res.ok) throw new Error(body.error ?? `Tavily request failed (${res.status})`);
    return (body.results ?? []).map((r) => ({
      title: r.title ?? r.url ?? '',
      url: r.url ?? '',
      content: r.raw_content || r.content || '',
      publishedDate: r.published_date,
      score: r.score,
    }));
  }
}
