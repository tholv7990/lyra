import { api } from './api';
import type {
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
}

export const marketplaceApi = {
  // Browse the global catalog. `forDevs` is sent only when explicitly set so the
  // default (mixed) catalog is returned when the filter is off.
  list: (ws: string, { page, limit, q, forDevs }: ListParams = {}) => {
    const params = new URLSearchParams();
    if (page != null) params.set('page', String(page));
    if (limit != null) params.set('limit', String(limit));
    if (q?.trim()) params.set('q', q.trim());
    if (forDevs != null) params.set('forDevs', forDevs ? 'true' : 'false');
    const qs = params.toString();
    return api<Paged<MarketplacePrompt>>(`${base(ws)}/prompts${qs ? `?${qs}` : ''}`);
  },

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
