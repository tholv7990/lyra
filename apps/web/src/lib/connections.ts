import { ChannelType, type Channel } from '@lyra/shared';

// A derived grouping of channels into a "connection" — a GoLogin browser profile
// (owns multiple platform accounts) or the single Postiz pool. NOTHING is persisted;
// this is a pure view over the flat Channel list.
// See docs/superpowers/specs/2026-06-22-multi-platform-accounts-design.md
export interface Connection {
  key: string; // group key: `gologin:${profileId}` | 'postiz'
  connector: ChannelType;
  profileId?: string; // GoLogin only
  proxy?: string; // GoLogin only — first account that carries one
  accounts: Channel[]; // grouped channels, in input order
  postCount: number; // sum over accounts
  lastPostAt?: string; // max over accounts (ISO strings sort lexically)
}

export function connectionKey(c: Channel): string {
  return c.type === ChannelType.GoLogin ? `gologin:${c.profileId ?? ''}` : 'postiz';
}

export function groupChannels(channels: Channel[]): Connection[] {
  const order: string[] = [];
  const map = new Map<string, Connection>();
  for (const c of channels) {
    const key = connectionKey(c);
    let conn = map.get(key);
    if (!conn) {
      conn = {
        key,
        connector: c.type,
        profileId: c.type === ChannelType.GoLogin ? c.profileId : undefined,
        accounts: [],
        postCount: 0,
      };
      map.set(key, conn);
      order.push(key);
    }
    conn.accounts.push(c);
    conn.postCount += c.postCount ?? 0;
    if (!conn.proxy && c.proxy) conn.proxy = c.proxy;
    if (c.lastPostAt && (!conn.lastPostAt || c.lastPostAt > conn.lastPostAt)) {
      conn.lastPostAt = c.lastPostAt;
    }
  }
  return order.map((k) => map.get(k)!);
}

// Compact a long GoLogin profile id for display (header chip). i18n-free on purpose.
export function shortProfileId(id?: string): string {
  if (!id) return '';
  return id.length <= 8 ? id : `${id.slice(0, 6)}…`;
}
