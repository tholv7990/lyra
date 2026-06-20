import { api } from './api';
import type { Channel, ConnectorCredentialInfo, CrawlerCookieInfo, DownloadJob, MediaItem, PublishJob } from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/connectors`;

export const connectorsApi = {
  saveCredential: (ws: string, connector: string, apiKey: string) =>
    api<ConnectorCredentialInfo>(`${base(ws)}/credentials`, {
      method: 'PUT',
      body: JSON.stringify({ connector, apiKey }),
    }),

  credentialStatus: (ws: string) =>
    api<ConnectorCredentialInfo>(`${base(ws)}/credentials`),

  connectLink: (ws: string, connector: string) =>
    api<{ url: string }>(`${base(ws)}/connect-link?connector=${encodeURIComponent(connector)}`),

  channels: (ws: string) => api<{ channels: Channel[] }>(`${base(ws)}/channels`),

  publish: (ws: string, channelIds: string[], caption: string, mediaUrls: string[]) =>
    api<PublishJob>(`${base(ws)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ channelIds, caption, mediaUrls }),
    }),

  job: (ws: string, jobId: string) => api<PublishJob>(`${base(ws)}/jobs/${jobId}`),

  resolve: (ws: string, url: string) =>
    api<{ items: MediaItem[] }>(`${base(ws)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  // Start an async download → { jobId }; poll downloadJob for live progress.
  startDownload: (ws: string, url: string, indices?: number[], format?: string) =>
    api<{ jobId: string }>(`${base(ws)}/download`, {
      method: 'POST',
      body: JSON.stringify({ url, indices, format }),
    }),

  downloadJob: (ws: string, jobId: string) =>
    api<DownloadJob>(`${base(ws)}/download-jobs/${jobId}`),

  cookieStatus: (ws: string) => api<CrawlerCookieInfo>(`${base(ws)}/cookies`),

  setCookies: (ws: string, cookies: string) =>
    api<CrawlerCookieInfo>(`${base(ws)}/cookies`, { method: 'PUT', body: JSON.stringify({ cookies }) }),

  deleteCookies: (ws: string) =>
    api<CrawlerCookieInfo>(`${base(ws)}/cookies`, { method: 'DELETE' }),
};
