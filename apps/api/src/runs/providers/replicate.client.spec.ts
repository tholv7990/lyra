import { ReplicateClient } from './replicate.client';

const created = { ok: true, json: async () => ({ id: 'pred-1', status: 'starting' }) };
const poll = (status: string, output?: unknown, error?: string) => ({ ok: true, json: async () => ({ status, output, error }) });

describe('ReplicateClient', () => {
  afterEach(() => jest.restoreAllMocks());
  const fast = { intervalMs: 0, deadlineMs: 1000 };

  it('creates a prediction and polls until succeeded, returning the first output URL', async () => {
    const f = jest.spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(created as never)             // create
      .mockResolvedValueOnce(poll('processing') as never)  // poll 1
      .mockResolvedValueOnce(poll('succeeded', ['https://cdn/out.mp4']) as never); // poll 2
    const url = await new ReplicateClient().run('minimax/video-01', { prompt: 'a cat' }, 'tok', fast);
    expect(url).toBe('https://cdn/out.mp4');
    const [createUrl, init] = f.mock.calls[0] as [string, RequestInit];
    expect(createUrl).toBe('https://api.replicate.com/v1/models/minimax/video-01/predictions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ input: { prompt: 'a cat' } });
  });

  it('accepts a bare string output', async () => {
    jest.spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(created as never)
      .mockResolvedValueOnce(poll('succeeded', 'https://cdn/one.mp4') as never);
    expect(await new ReplicateClient().run('m/n', { prompt: 'x' }, 'tok', fast)).toBe('https://cdn/one.mp4');
  });

  it('throws on a failed prediction', async () => {
    jest.spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(created as never)
      .mockResolvedValueOnce(poll('failed', undefined, 'nsfw') as never);
    await expect(new ReplicateClient().run('m/n', { prompt: 'x' }, 'tok', fast)).rejects.toThrow(/failed/i);
  });

  it('throws when the deadline passes before success', async () => {
    jest.spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(created as never)
      .mockResolvedValue(poll('processing') as never); // always processing
    await expect(new ReplicateClient().run('m/n', { prompt: 'x' }, 'tok', { intervalMs: 0, deadlineMs: 0 }))
      .rejects.toThrow(/time limit|exceeded/i);
  });

  it('throws a clean error (no token) on a non-2xx create', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({ ok: false, status: 402, json: async () => ({ detail: 'billing' }) } as never);
    await expect(new ReplicateClient().run('m/n', { prompt: 'x' }, 'secret', fast)).rejects.toThrow(/replicate create.*402/i);
  });
});
