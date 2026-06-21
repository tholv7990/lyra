import { ChannelType } from '@lyra/shared';
import { mapIntegrations, okReceipt, failReceipt, createPost } from './postiz.client';

describe('mapIntegrations', () => {
  it('maps integrations to channels (identifier → platform, lowercased)', () => {
    const out = mapIntegrations([{ id: 'i1', name: '@me.bsky', identifier: 'Bluesky' }]);
    expect(out).toEqual([{ id: 'i1', type: ChannelType.Postiz, platform: 'bluesky', displayName: '@me.bsky' }]);
  });
  it('tolerates a wrapped { integrations: [] }, missing fields, and null', () => {
    expect(mapIntegrations({ integrations: [{ id: 'x' }] })).toEqual([
      { id: 'x', type: ChannelType.Postiz, platform: 'unknown', displayName: 'x' },
    ]);
    expect(mapIntegrations(null)).toEqual([]);
  });
});

describe('receipts', () => {
  const ch = { id: 'i1', type: ChannelType.Postiz, platform: 'bluesky', displayName: '@me' };
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

describe('createPost error sanitization', () => {
  const mockFetch = jest.fn();
  beforeEach(() => { (global as unknown as Record<string, unknown>).fetch = mockFetch; });
  afterEach(() => { jest.clearAllMocks(); });

  it('throws a message containing the status but NOT the upstream body fragment', async () => {
    const upstreamBody = 'rate limit exceeded for plan basic_v1';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue(upstreamBody),
    });

    await expect(
      createPost('http://postiz:5000', 'key', 'i1', 'hello', []),
    ).rejects.toMatchObject({
      message: expect.stringContaining('429'),
    });

    // The upstream body MUST NOT appear in the thrown message
    let thrownMessage = '';
    try {
      await createPost('http://postiz:5000', 'key', 'i1', 'hello', []);
    } catch (e) {
      thrownMessage = e instanceof Error ? e.message : String(e);
    }
    expect(thrownMessage).not.toContain('rate limit');
    expect(thrownMessage).not.toContain('basic_v1');
  });
});
