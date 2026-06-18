import type { Channel, Receipt } from '@lyra/shared';

// Postiz public API client. base = POSTIZ_API_URL (self-hosted instance root);
// auth = the workspace's Postiz API key, sent verbatim in Authorization.
// VERIFY: integration/post JSON field names are confirmed against the live
// instance during the e2e (Task 10); the mappers read defensively.

export interface RawIntegration {
  id: string;
  name?: string;
  identifier?: string; // platform, e.g. 'bluesky' | 'mastodon' | 'tiktok'
  provider?: string;
  disabled?: boolean;
}

export interface UploadResult { id: string; path: string }

const v1 = (base: string) => `${base.replace(/\/+$/, '')}/public/v1`;

// --- pure mappers (unit-tested) ---

export function mapIntegrations(json: unknown): Channel[] {
  const arr = Array.isArray(json)
    ? json
    : ((json as { integrations?: unknown[] } | null)?.integrations ?? []);
  return (arr as RawIntegration[]).map((i) => ({
    id: i.id,
    platform: (i.identifier ?? i.provider ?? 'unknown').toLowerCase(),
    displayName: i.name ?? i.id,
  }));
}

export function okReceipt(ch: Channel, json: unknown): Receipt {
  const r = (json ?? {}) as {
    id?: string; postId?: string; url?: string; releaseURL?: string;
    posts?: { url?: string; id?: string }[];
  };
  const first = r.posts?.[0];
  return {
    platform: ch.platform,
    accountId: ch.id,
    status: 'ok',
    postId: r.postId ?? r.id ?? first?.id,
    url: r.url ?? r.releaseURL ?? first?.url,
  };
}

export function failReceipt(ch: Channel, error: string): Receipt {
  return { platform: ch.platform, accountId: ch.id, status: 'failed', error: error.slice(0, 300) };
}

// --- network functions (integration; not unit-tested, like runYtDlp) ---

export async function listIntegrations(base: string, key: string): Promise<unknown> {
  const res = await fetch(`${v1(base)}/integrations`, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Postiz integrations ${res.status}`);
  return res.json();
}

export async function uploadMedia(
  base: string, key: string, bytes: Uint8Array, filename: string, mime: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${v1(base)}/upload`, { method: 'POST', headers: { Authorization: key }, body: form });
  if (!res.ok) throw new Error(`Postiz upload ${res.status}`);
  return (await res.json()) as UploadResult;
}

export async function createPost(
  base: string, key: string, integrationId: string, content: string, media: UploadResult[],
): Promise<unknown> {
  const value = [{ content, ...(media.length ? { image: media } : {}) }];
  const body = { type: 'now', posts: [{ integration: { id: integrationId }, value }] };
  const res = await fetch(`${v1(base)}/posts`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Postiz post ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
