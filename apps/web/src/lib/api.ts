// Empty default = same-origin: in dev the Vite proxy forwards /auth, /workspaces,
// etc. to the API; in prod set VITE_API_URL to the API origin.
const API_URL = import.meta.env.VITE_API_URL ?? '';

// The access token lives in memory only — never localStorage. The refresh
// token is an httpOnly cookie the browser sends automatically.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// The active workspace — sent as X-Workspace-Id so workspace-scoped endpoints
// (projects, runs, keys in later phases) target the right tenant.
let currentWorkspaceId: string | null = null;

export function setWorkspaceId(id: string | null) {
  currentWorkspaceId = id;
}

export function getWorkspaceId() {
  return currentWorkspaceId;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// De-duplicate concurrent refreshes into a single in-flight request.
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    setAccessToken(null);
    return false;
  }
  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return true;
}

export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// Single-flight session restore for app load. Memoized for the whole page
// lifetime (never reset) so StrictMode double-mounts / multiple providers can't
// fire a second /auth/refresh that races the rotated cookie — which would 401
// and sign the user out on every reload.
let bootstrapPromise: Promise<boolean> | null = null;

export function bootstrapSession(): Promise<boolean> {
  if (!bootstrapPromise) bootstrapPromise = doRefresh();
  return bootstrapPromise;
}

interface ApiOptions extends RequestInit {
  /** When false, do not attempt a silent refresh + retry on 401. */
  retry?: boolean;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { retry = true, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(currentWorkspaceId ? { 'X-Workspace-Id': currentWorkspaceId } : {}),
      ...headers,
    },
  });

  // On 401, transparently refresh the access token once, then retry.
  if (res.status === 401 && retry && path !== '/auth/refresh') {
    const ok = await refreshSession();
    if (ok) return api<T>(path, { ...options, retry: false });
  }

  if (!res.ok) {
    let message: string = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      }
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
