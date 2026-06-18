import { mapIntegrations, okReceipt, failReceipt } from './postiz.client';

describe('mapIntegrations', () => {
  it('maps integrations to channels (identifier → platform, lowercased)', () => {
    const out = mapIntegrations([{ id: 'i1', name: '@me.bsky', identifier: 'Bluesky' }]);
    expect(out).toEqual([{ id: 'i1', platform: 'bluesky', displayName: '@me.bsky' }]);
  });
  it('tolerates a wrapped { integrations: [] }, missing fields, and null', () => {
    expect(mapIntegrations({ integrations: [{ id: 'x' }] })).toEqual([
      { id: 'x', platform: 'unknown', displayName: 'x' },
    ]);
    expect(mapIntegrations(null)).toEqual([]);
  });
});

describe('receipts', () => {
  const ch = { id: 'i1', platform: 'bluesky', displayName: '@me' };
  it('okReceipt pulls postId/url defensively (flat or nested posts[])', () => {
    expect(okReceipt(ch, { id: 'p1', url: 'https://bsky.app/p/1' })).toEqual({
      platform: 'bluesky', accountId: 'i1', status: 'ok', postId: 'p1', url: 'https://bsky.app/p/1',
    });
    expect(okReceipt(ch, { posts: [{ id: 'p2', url: 'u2' }] })).toMatchObject({ postId: 'p2', url: 'u2' });
  });
  it('failReceipt records a trimmed error', () => {
    expect(failReceipt(ch, 'boom')).toEqual({
      platform: 'bluesky', accountId: 'i1', status: 'failed', error: 'boom',
    });
  });
});
