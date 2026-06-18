import { PublishService } from './publish.service';
import * as postiz from './postiz.client';

function svc() {
  return new PublishService({
    get: (k: string) =>
      k === 'POSTIZ_API_URL' ? 'http://postiz:5000'
      : k === 'POSTIZ_PUBLIC_URL' ? 'http://localhost:5000'
      : '900000',
  } as never);
}

const RAW = [
  { id: 'i1', name: '@a', identifier: 'bluesky' },
  { id: 'i2', name: '@b', identifier: 'mastodon' },
];

describe('PublishService', () => {
  beforeEach(() => {
    jest.spyOn(postiz, 'listIntegrations').mockResolvedValue(RAW); // real mapIntegrations runs
  });
  afterEach(() => jest.restoreAllMocks());

  it('connectUrl returns the Postiz public URL', () => {
    expect(svc().connectUrl()).toEqual({ url: 'http://localhost:5000' });
  });

  it('posts per channel; partial failure tolerated; job → done', async () => {
    jest.spyOn(postiz, 'createPost').mockImplementation((_b, _k, id) =>
      id === 'i2'
        ? Promise.reject(new Error('dead token'))
        : Promise.resolve({ id: 'p1', url: 'u1' }),
    );
    const s = svc();
    const { jobId, status } = s.publish('key', { channelIds: ['i1', 'i2'], caption: 'hi', mediaUrls: [] });
    expect(status).toBe('queued');
    // wait for the background runPublish to settle
    for (let i = 0; i < 100 && !['done', 'failed'].includes(s.job(jobId)!.status); i++) {
      await new Promise((r) => setImmediate(r));
    }
    expect(s.job(jobId)).toEqual({
      jobId,
      status: 'done',
      receipts: [
        { platform: 'bluesky', accountId: 'i1', status: 'ok', postId: 'p1', url: 'u1' },
        { platform: 'mastodon', accountId: 'i2', status: 'failed', error: 'dead token' },
      ],
    });
  });

  it('rejects an unsafe media URL (SSRF) before posting', async () => {
    await expect(
      svc().runPublish('j', 'key', { channelIds: ['i1'], caption: 'x', mediaUrls: ['http://169.254.169.254/'] }),
    ).rejects.toThrow();
  });
});
