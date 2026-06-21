import { api } from './api';
import type { Channel, CreateChannelDto } from '@lyra/shared';

// The unified channel list (Postiz pool + stored GoLogin channels). The source of
// truth for "what can this workspace post to" — used by Connections + project pickers.
export const channelsApi = {
  list: (ws: string) => api<Channel[]>(`/workspaces/${ws}/channels`),
  create: (ws: string, body: CreateChannelDto) =>
    api<Channel>(`/workspaces/${ws}/channels`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (ws: string, id: string) =>
    api<void>(`/workspaces/${ws}/channels/${id}`, { method: 'DELETE' }),
};
