import { api } from './api';
import type { Channel, CreateChannelDto, PublishJob } from '@lyra/shared';

// The unified channel list (Postiz pool + stored GoLogin channels). The source of
// truth for "what can this workspace post to" — used by Connections + project pickers.
export const channelsApi = {
  list: (ws: string) => api<Channel[]>(`/workspaces/${ws}/channels`),
  create: (ws: string, body: CreateChannelDto) =>
    api<Channel>(`/workspaces/${ws}/channels`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (ws: string, id: string) =>
    api<void>(`/workspaces/${ws}/channels/${id}`, { method: 'DELETE' }),

  // Publish to the selected channels — the api routes each by type (Postiz / GoLogin
  // browser) and returns one composite job to poll via job().
  publish: (ws: string, channelIds: string[], caption: string, mediaUrls: string[]) =>
    api<PublishJob>(`/workspaces/${ws}/channels/publish`, {
      method: 'POST',
      body: JSON.stringify({ channelIds, caption, mediaUrls }),
    }),
  job: (ws: string, jobId: string) => api<PublishJob>(`/workspaces/${ws}/channels/jobs/${jobId}`),
};
