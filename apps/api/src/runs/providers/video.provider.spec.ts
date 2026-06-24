import { VideoStepProvider } from './video.provider';

describe('VideoStepProvider', () => {
  afterEach(() => jest.restoreAllMocks());
  const make = () => {
    const replicate = { create: jest.fn().mockResolvedValue({ id: 'pred1', status: 'starting' }) };
    const storage = { store: jest.fn().mockResolvedValue('https://r2/v.mp4'), enabled: true };
    return { p: new VideoStepProvider(replicate as never, storage as never), replicate, storage };
  };

  it('submits a video prediction and returns async jobId (no assets yet)', async () => {
    const { p, replicate } = make();
    const out = await p.execute({ step: { prompt: 'a cat', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } });
    expect(replicate.create).toHaveBeenCalledWith('minimax/video-01', { prompt: 'a cat' }, 'tok');
    expect((out as any).async.jobId).toBe('pred1');
    expect(out.assets).toBeUndefined();
  });

  it('throws without a key', async () => {
    const { p } = make();
    await expect(p.execute({ step: { prompt: 'x' } as never, apiKey: '', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } })).rejects.toThrow(/Replicate key/i);
  });

  it('rejects if storage is not enabled and does not call replicate.create', async () => {
    const { p, replicate, storage } = make();
    // Override storage.enabled to false
    Object.defineProperty(storage, 'enabled', { value: false });
    await expect(p.execute({ step: { prompt: 'test', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } }))
      .rejects.toThrow(/durable object storage|R2/i);
    expect(replicate.create).not.toHaveBeenCalled();
  });

  it('img2video: passes the input image URL under the model image field for a mapped model', async () => {
    const { p, replicate } = make();
    await p.execute({
      step: { prompt: 'animate it', model: 'minimax/video-01' } as never,
      apiKey: 'tok', priorResults: [],
      inputImages: [{ url: 'https://r2/logo.png', mime: 'image/png', b64: 'x' }], workspaceId: 'ws',
      ledger: { evidence: [], sources: [], data: {}, variables: {} },
    });
    expect(replicate.create).toHaveBeenCalledWith(
      'minimax/video-01',
      { prompt: 'animate it', first_frame_image: 'https://r2/logo.png' },
      'tok',
    );
  });

  it('text->video + note when the model has no image-to-video field but an image was supplied', async () => {
    const { p, replicate } = make();
    const out = await p.execute({
      step: { prompt: 'a cat', model: 'luma/ray' } as never,
      apiKey: 'tok', priorResults: [],
      inputImages: [{ url: 'https://r2/logo.png', mime: 'image/png', b64: 'x' }], workspaceId: 'ws',
      ledger: { evidence: [], sources: [], data: {}, variables: {} },
    });
    expect(replicate.create).toHaveBeenCalledWith('luma/ray', { prompt: 'a cat' }, 'tok');
    expect(out.result).toMatch(/no image-to-video input/i);
  });

  it('no input images -> plain prompt (unchanged)', async () => {
    const { p, replicate } = make();
    await p.execute({ step: { prompt: 'a cat', model: 'minimax/video-01' } as never, apiKey: 'tok', priorResults: [], workspaceId: 'ws', ledger: { evidence: [], sources: [], data: {}, variables: {} } });
    expect(replicate.create).toHaveBeenCalledWith('minimax/video-01', { prompt: 'a cat' }, 'tok');
  });

  it('finalize: re-hosts the mp4 and returns a video asset', async () => {
    const { p, storage } = make();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) } as never);
    const out = await p.finalize({ id: 'p', status: 'succeeded', output: ['https://x/v.mp4'] } as any, 'minimax/video-01');
    expect(storage.store).toHaveBeenCalledWith(expect.any(Buffer), 'video/mp4', expect.stringContaining('generated/'));
    expect(out.assets![0].type).toBe('video');
    expect(out.assets![0].url).toBe('https://r2/v.mp4');
  });
});
