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

// Serialize refreshes ACROSS tabs with the Web Locks API. The server rotates
// the refresh token on every /auth/refresh (consumes the old one, no grace
// window), so two tabs refreshing at once race: the loser presents an
// already-consumed token, gets 401, and the whole session is signed out. The
// lock makes each tab refresh in turn against the latest cookie. Falls back to
// a bare call where Web Locks is unavailable (older / non-secure contexts, the
// node test env) — there the single-flight guard below still covers same-tab.
function lockedRefresh(): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request('lyra-auth-refresh', doRefresh) : doRefresh();
}

export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = lockedRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// Single-flight session restore for app load. Memoized for the whole page
// lifetime (never reset) so StrictMode double-mounts / multiple providers reuse
// one result. Routed through refreshSession so a query that 401s before
// bootstrap resolves collapses into the SAME request instead of firing a second
// /auth/refresh that races the rotated cookie — which would sign the user out.
let bootstrapPromise: Promise<boolean> | null = null;

export function bootstrapSession(): Promise<boolean> {
  if (!bootstrapPromise) bootstrapPromise = refreshSession();
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

  // For multipart (file upload) let the browser set Content-Type (+ boundary);
  // only default to JSON otherwise.
  const isForm = rest.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(currentWorkspaceId ? { 'X-Workspace-Id': currentWorkspaceId } : {}),
      ...headers,
    },
  });

  // On 401, transparently refresh the access token once, then retry — but not
  // for the session-establishing endpoints (a 401 there is bad credentials, not
  // an expired token).
  const noRefresh = ['/auth/refresh', '/auth/login', '/auth/signup'];
  if (res.status === 401 && retry && !noRefresh.includes(path)) {
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

// Download a binary response (single file or zip) through the authed API and
// save it to disk. Mirrors api()'s auth (Bearer + workspace header) and the
// single 401→refresh→retry, but reads a Blob and triggers a browser save —
// the server proxies cross-origin assets so the download forces and carries auth.
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(currentWorkspaceId ? { 'X-Workspace-Id': currentWorkspaceId } : {}),
      },
    });

  let res = await doFetch();
  if (res.status === 401) {
    const ok = await refreshSession();
    if (ok) res = await doFetch();
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);

  const blob = await res.blob();
  const name =
    filenameFromDisposition(res.headers.get('Content-Disposition')) ?? fallbackName;
  saveBlob(blob, name);
}

function filenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : null;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// POST a request and consume a Server-Sent Events stream, invoking onEvent for
// each parsed `data:` payload. Errors before the stream opens (4xx) throw an
// ApiError; errors mid-stream arrive as events for the caller to handle.
export async function streamSSE(
  path: string,
  body: unknown,
  onEvent: (evt: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(currentWorkspaceId ? { 'X-Workspace-Id': currentWorkspaceId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let message: string = res.statusText;
    try {
      const b = (await res.json()) as { message?: string | string[] };
      if (b.message) {
        message = Array.isArray(b.message) ? b.message.join(', ') : b.message;
      }
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep).trim();
      buffer = buffer.slice(sep + 2);
      if (!chunk.startsWith('data:')) continue;
      const payload = chunk.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as Record<string, unknown>);
      } catch {
        // ignore malformed event
      }
    }
  }
}
