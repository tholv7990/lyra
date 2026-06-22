import { api } from './api';
import type { Competitor, CompetitorStatus, MonitorStats, CompetitorChangelog, MonitorAd } from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/monitor`;

export const monitorApi = {
  list: (ws: string, status?: CompetitorStatus) =>
    api<Competitor[]>(`${base(ws)}/competitors${status ? `?status=${status}` : ''}`),

  discover: (ws: string, keywords: string[]) =>
    api<Competitor[]>(`${base(ws)}/discover`, { method: 'POST', body: JSON.stringify({ keywords }) }),

  approve: (ws: string, cid: string) =>
    api<Competitor>(`${base(ws)}/competitors/${cid}/approve`, { method: 'POST' }),

  reject: (ws: string, cid: string) =>
    api<Competitor>(`${base(ws)}/competitors/${cid}/reject`, { method: 'POST' }),

  remove: (ws: string, cid: string) =>
    api<void>(`${base(ws)}/competitors/${cid}`, { method: 'DELETE' }),

  changelog: (ws: string, days = 7) =>
    api<{ stats: MonitorStats; byDay: { date: string; competitors: CompetitorChangelog[] }[] }>(
      `${base(ws)}/changelog?days=${days}`
    ),

  ads: (ws: string, cid?: string) =>
    api<MonitorAd[]>(`${base(ws)}/ads${cid ? `?competitorId=${cid}` : ''}`),

  runNow: (ws: string) => api<{ ok: boolean }>(`${base(ws)}/run-now`, { method: 'POST' }),
};
