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
    const out = await p.execute({ step: { prompt: 'a cat', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } });
    expect(replicate.run).toHaveBeenCalledWith('minimax/video-01', { prompt: 'a cat' }, 'tok', expect.anything());
    expect(storage.store).toHaveBeenCalledWith(expect.any(Buffer), 'video/mp4', expect.stringContaining('generated/'));
    expect(out.assets).toEqual([{ type: 'video', url: 'https://r2/generated/x.mp4', meta: expect.objectContaining({ role: 'generated', model: 'minimax/video-01' }) }]);
  });

  it('throws without a key', async () => {
    const { p } = make();
    await expect(p.execute({ step: { prompt: 'x' } as never, apiKey: '', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } })).rejects.toThrow(/Replicate key/i);
  });

  it('throws if the rendered video can not be fetched for re-hosting', async () => {
    const { p } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: false, status: 404 } as never);
    await expect(p.execute({ step: { prompt: 'x', model: 'm/n' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } })).rejects.toThrow(/video/i);
  });

  it('rejects if storage is not enabled and does not call replicate.run', async () => {
    const { p, replicate, storage } = make();
    // Override storage.enabled to false
    Object.defineProperty(storage, 'enabled', { value: false });
    await expect(p.execute({ step: { prompt: 'test', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } }))
      .rejects.toThrow(/durable object storage|R2/i);
    expect(replicate.run).not.toHaveBeenCalled();
  });

  it('img2video: passes the input image URL under the model image field for a mapped model', async () => {
    const { p, replicate } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as never);
    await p.execute({
      step: { prompt: 'animate it', model: 'minimax/video-01' } as never,
      apiKey: 'tok', priorResults: [],
      inputImages: [{ url: 'https://r2/logo.png', mime: 'image/png', b64: 'x' }], workspaceId: 'ws',
      ledger: { evidence: [], sources: [], data: {}, variables: {} },
    });
    expect(replicate.run).toHaveBeenCalledWith(
      'minimax/video-01',
      { prompt: 'animate it', first_frame_image: 'https://r2/logo.png' },
      'tok',
      expect.anything(),
    );
  });

  it('text->video + note when the model has no image-to-video field but an image was supplied', async () => {
    const { p, replicate } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as never);
    const out = await p.execute({
      step: { prompt: 'a cat', model: 'luma/ray' } as never,
      apiKey: 'tok', priorResults: [],
      inputImages: [{ url: 'https://r2/logo.png', mime: 'image/png', b64: 'x' }], workspaceId: 'ws',
      ledger: { evidence: [], sources: [], data: {}, variables: {} },
    });
    expect(replicate.run).toHaveBeenCalledWith('luma/ray', { prompt: 'a cat' }, 'tok', expect.anything());
    expect(out.result).toMatch(/no image-to-video input/i);
  });

  it('no input images -> plain prompt (unchanged)', async () => {
    const { p, replicate } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as never);
    await p.execute({ step: { prompt: 'a cat', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } });
    expect(replicate.run).toHaveBeenCalledWith('minimax/video-01', { prompt: 'a cat' }, 'tok', expect.anything());
  });
});
