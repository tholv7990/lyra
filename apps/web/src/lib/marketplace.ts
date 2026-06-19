import { api } from './api';
import type {
  MarketplaceFacets,
  MarketplacePrompt,
  Paged,
  Prompt,
  RankedMarketplacePrompt,
} from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/marketplace`;

interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
  forDevs?: boolean;
  types?: string[];
  categories?: string[];
  tags?: string[];
}

export const marketplaceApi = {
  // Browse the global catalog. `forDevs` is sent only when explicitly set so the
  // default (mixed) catalog is returned when the filter is off. Multi-select
  // type/category/tag filters are sent as repeated params (`type`/`category`/
  // `tag`) — same encoding the prompts list uses, matching the api.
  list: (ws: string, { page, limit, q, forDevs, types, categories, tags }: ListParams = {}) => {
    const params = new URLSearchParams();
    if (page != null) params.set('page', String(page));
    if (limit != null) params.set('limit', String(limit));
    if (q?.trim()) params.set('q', q.trim());
    if (forDevs != null) params.set('forDevs', forDevs ? 'true' : 'false');
    types?.forEach((ty) => params.append('type', ty));
    categories?.forEach((c) => params.append('category', c));
    tags?.forEach((tag) => params.append('tag', tag));
    const qs = params.toString();
    return api<Paged<MarketplacePrompt>>(`${base(ws)}/prompts${qs ? `?${qs}` : ''}`);
  },

  // Filter vocabularies (distinct categories + tags) for the browse filter.
  facets: (ws: string) => api<MarketplaceFacets>(`${base(ws)}/facets`),

  // AI filter: Claude ranks the catalog against a free-text need.
  rank: (ws: string, query: string, limit?: number) =>
    api<RankedMarketplacePrompt[]>(`${base(ws)}/rank`, {
      method: 'POST',
      body: JSON.stringify({ query, ...(limit != null ? { limit } : {}) }),
    }),

  // Adopt a catalog prompt into the workspace library (creates a real Prompt).
  adopt: (ws: string, promptId: string) =>
    api<Prompt>(`${base(ws)}/adopt`, {
      method: 'POST',
      body: JSON.stringify({ promptId }),
    }),
};
