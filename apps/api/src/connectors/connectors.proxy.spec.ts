import { HttpException } from '@nestjs/common';
import { ConnectorsProxy, rewriteDownload } from './connectors.proxy';

function proxy(url?: string) {
  const config = { get: (k: string) => (k === 'CONNECTORS_SERVICE_URL' ? url : 'tok') };
  return new ConnectorsProxy(config as never);
}

describe('ConnectorsProxy (mock mode — no service URL)', () => {
  const p = proxy(undefined);

  it('returns mock channels', async () => {
    const out = await p.forward('ws', 'u', 'GET', 'channels');
    expect(Array.isArray(out.channels)).toBe(true);
    expect((out.channels as unknown[]).length).toBeGreaterThan(0);
  });

  it('publish returns a jobId, then the job is done with receipts', async () => {
    const pub = await p.forward('ws', 'u', 'POST', 'publish', {
      channelIds: ['c1'],
      caption: 'hi',
      mediaUrls: [],
    });
    expect(pub.jobId).toBeTruthy();
    const job = await p.forward('ws', 'u', 'GET', `jobs/${pub.jobId as string}`);
    expect(job.status).toBe('done');
    expect(Array.isArray(job.receipts)).toBe(true);
  });

  it('resolve returns media items', async () => {
    const out = await p.forward('ws', 'u', 'POST', 'resolve', { url: 'https://x' });
    expect((out.items as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('ConnectorsProxy (forward mode — service URL set)', () => {
  it('forwards to the service with auth + workspace headers', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ channels: [] }) });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    await proxy('http://svc:9100/').forward('ws1', 'u1', 'GET', 'channels');

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('http://svc:9100/channels');
    expect(init.headers['X-Workspace-Id']).toBe('ws1');
    expect(init.headers['X-User-Id']).toBe('u1');
    expect(init.headers.Authorization).toContain('Bearer');
  });

  // Regression: a non-2xx upstream must NOT be passed back as a success body.
  // Previously forward() returned the error JSON verbatim, so the api answered 200
  // with no `channels`, and the web Connections page crashed on `channels.map`.
  it('throws 502 on a 5xx upstream instead of returning the error body as success', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ statusCode: 500, message: 'Internal server error' }),
    });
    const err = await proxy('http://svc:9100/')
      .forward('ws1', 'u1', 'GET', 'channels', undefined, 'bad-key')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(502);
  });

  it('propagates a 4xx upstream status as-is (e.g. missing key → 401)', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'missing connector key' }),
    });
    const err = await proxy('http://svc:9100/')
      .forward('ws1', 'u1', 'GET', 'channels')
      .catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(401);
  });
});

describe('rewriteDownload', () => {
  it('rewrites service fileIds to Lyra file URLs', () => {
    const out = rewriteDownload('ws1', { items: [{ fileId: 'abc', filename: 'v.mp4' }] });
    expect(out.items[0]).toEqual({ url: '/workspaces/ws1/connectors/files/abc', filename: 'v.mp4' });
  });
  it('passes through absolute urls (mock mode)', () => {
    const out = rewriteDownload('ws1', { items: [{ url: 'https://example.com/x', filename: 'm.zip' }] });
    expect(out.items[0]).toEqual({ url: 'https://example.com/x', filename: 'm.zip' });
  });
});
