import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserSummary,
  Paged,
  RequestStatus,
  UserRequest,
} from '@lyra/shared';
import { api } from './api';

// Platform-level operations, gated to admins server-side (the api guard is the
// real enforcement — the UI only reveals the surface). These endpoints are NOT
// workspace-scoped: they hit `/admin/...` directly.

// The shared prompt catalog (prompts.chat) sync state.
export interface CatalogStats {
  count: number;
  lastSyncedAt: string | null;
}

// Query for the paginated admin Users list.
export interface AdminUsersQuery {
  page: number;
  limit: number;
  q?: string;
}

export const adminApi = {
  // Platform-wide counts + recent signups for the Overview dashboard.
  overview: () => api<AdminOverview>('/admin/overview'),

  // A page of users for the Users list. `q` filters by name/email (debounced
  // upstream); blank/whitespace-only queries are dropped so the param stays clean.
  users: ({ page, limit, q }: AdminUsersQuery) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q && q.trim()) params.set('q', q.trim());
    return api<Paged<AdminUserSummary>>(`/admin/users?${params.toString()}`);
  },

  // Full detail for one user: workspaces + per-user usage breakdown.
  user: (id: string) => api<AdminUserDetail>(`/admin/users/${id}`),

  // Activate / deactivate a user. The api returns the updated summary and blocks
  // deactivating your own account (400) — the caller surfaces that message.
  setUserActive: (id: string, active: boolean) =>
    api<AdminUserSummary>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  // Current state of the shared prompt catalog.
  catalogStats: () => api<CatalogStats>('/admin/marketplace/stats'),

  // Re-import the catalog from prompts.chat. Returns how many were imported.
  syncCatalog: () =>
    api<{ imported: number }>('/admin/marketplace/sync', { method: 'POST' }),

  // User requests (provider requests now; bug reports later), newest first.
  requests: (filter: { type?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (filter.type) params.set('type', filter.type);
    if (filter.status) params.set('status', filter.status);
    const qs = params.toString();
    return api<UserRequest[]>(`/admin/requests${qs ? `?${qs}` : ''}`);
  },

  // Triage a request: set its status (note reserved for later).
  setRequestStatus: (id: string, status: RequestStatus) =>
    api<UserRequest>(`/admin/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
