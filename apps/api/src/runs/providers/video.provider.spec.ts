import { VideoStepProvider } from './video.provider';

describe('VideoStepProvider', () => {
  afterEach(() => jest.restoreAllMocks());
  const make = () => {
    const replicate = { run: jest.fn().mockResolvedValue('https://cdn/out.mp4') };
    const storage = { store: jest.fn().mockResolvedValue('https://r2/generated/x.mp4'), enabled: true };
    return { p: new VideoStepProvider(replicate as never, storage as never), replicate, storage };
  };

  it('renders, re-hosts the mp4 to storage, and returns a video asset', async () => {
    const { p, replicate, storage } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as never);
    const out = await p.execute({ step: { prompt: 'a cat', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [] });
    expect(replicate.run).toHaveBeenCalledWith('minimax/video-01', { prompt: 'a cat' }, 'tok', expect.anything());
    expect(storage.store).toHaveBeenCalledWith(expect.any(Buffer), 'video/mp4', expect.stringContaining('generated/'));
    expect(out.assets).toEqual([{ type: 'video', url: 'https://r2/generated/x.mp4', meta: expect.objectContaining({ role: 'generated', model: 'minimax/video-01' }) }]);
  });

  it('throws without a key', async () => {
    const { p } = make();
    await expect(p.execute({ step: { prompt: 'x' } as never, apiKey: '', priorResults: [] })).rejects.toThrow(/Replicate key/i);
  });

  it('throws if the rendered video can not be fetched for re-hosting', async () => {
    const { p } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: false, status: 404 } as never);
    await expect(p.execute({ step: { prompt: 'x', model: 'm/n' } as never, apiKey: 'tok', priorResults: [] })).rejects.toThrow(/video/i);
  });

  it('rejects if storage is not enabled and does not call replicate.run', async () => {
    const { p, replicate, storage } = make();
    // Override storage.enabled to false
    Object.defineProperty(storage, 'enabled', { value: false });
    await expect(p.execute({ step: { prompt: 'test', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [] }))
      .rejects.toThrow(/durable object storage|R2/i);
    expect(replicate.run).not.toHaveBeenCalled();
  });
});
