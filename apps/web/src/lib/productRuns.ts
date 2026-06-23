import { api } from './api';
import type { Run } from '@lyra/shared';

export const productRunsApi = {
  start: (ws: string, productId: string) =>
    api<Run>(`/workspaces/${ws}/products/${productId}/runs`, { method: 'POST', body: JSON.stringify({}) }),
  list: (ws: string, productId: string) =>
    api<Run[]>(`/workspaces/${ws}/products/${productId}/runs`),
};
