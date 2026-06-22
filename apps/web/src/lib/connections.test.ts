import { describe, it, expect } from 'vitest';
import { ChannelType, type Channel } from '@lyra/shared';
import { groupChannels, connectionKey, shortProfileId } from './connections';

const mk = (over: Partial<Channel>): Channel =>
  ({ id: 'i', type: ChannelType.GoLogin, platform: 'tiktok', displayName: 'n', ...over } as Channel);

describe('groupChannels', () => {
  it('groups GoLogin channels sharing a profileId into one connection', () => {
    const conns = groupChannels([
      mk({ id: 'a', profileId: 'p1', platform: 'tiktok', postCount: 2, lastPostAt: '2026-06-01' }),
      mk({ id: 'b', profileId: 'p1', platform: 'facebook', postCount: 3, lastPostAt: '2026-06-10' }),
    ]);
    expect(conns).toHaveLength(1);
    expect(conns[0].connector).toBe(ChannelType.GoLogin);
    expect(conns[0].profileId).toBe('p1');
    expect(conns[0].accounts.map((c) => c.id)).toEqual(['a', 'b']);
    expect(conns[0].postCount).toBe(5);
    expect(conns[0].lastPostAt).toBe('2026-06-10'); // max
  });

  it('separates GoLogin channels with different profileIds', () => {
    const conns = groupChannels([
      mk({ id: 'a', profileId: 'p1' }),
      mk({ id: 'b', profileId: 'p2' }),
    ]);
    expect(conns).toHaveLength(2);
    expect(conns.map((c) => c.profileId)).toEqual(['p1', 'p2']);
  });

  it('groups all Postiz channels into a single pool, profileId undefined', () => {
    const conns = groupChannels([
      mk({ id: 'a', type: ChannelType.Postiz, profileId: undefined }),
      mk({ id: 'b', type: ChannelType.Postiz, profileId: undefined }),
    ]);
    expect(conns).toHaveLength(1);
    expect(conns[0].key).toBe('postiz');
    expect(conns[0].connector).toBe(ChannelType.Postiz);
    expect(conns[0].profileId).toBeUndefined();
    expect(conns[0].accounts).toHaveLength(2);
  });

  it('preserves first-appearance order across a mix and picks up proxy', () => {
    const conns = groupChannels([
      mk({ id: 'a', type: ChannelType.Postiz, profileId: undefined }),
      mk({ id: 'b', profileId: 'p1', proxy: 'us-1' }),
    ]);
    expect(conns.map((c) => c.key)).toEqual(['postiz', 'gologin:p1']);
    expect(conns[1].proxy).toBe('us-1');
  });

  it('returns [] for no channels', () => {
    expect(groupChannels([])).toEqual([]);
  });
});

describe('connectionKey / shortProfileId', () => {
  it('keys GoLogin by profileId and Postiz as the pool', () => {
    expect(connectionKey(mk({ profileId: 'p9' }))).toBe('gologin:p9');
    expect(connectionKey(mk({ type: ChannelType.Postiz, profileId: undefined }))).toBe('postiz');
  });
  it('shortens long profile ids and passes short/empty through', () => {
    expect(shortProfileId('6a33b9c0d1e2')).toBe('6a33b9…');
    expect(shortProfileId('abc')).toBe('abc');
    expect(shortProfileId(undefined)).toBe('');
  });
});
