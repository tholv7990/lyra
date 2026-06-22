import { GeminiImageStepProvider } from './gemini-image.provider';

describe('GeminiImageStepProvider', () => {
  const make = (over: Record<string, unknown> = {}) => {
    const client = { generateImage: jest.fn().mockResolvedValue({ b64: 'ZZZ', mime: 'image/png' }) };
    const storage = { store: jest.fn().mockResolvedValue('https://cdn/img.png') };
    return { p: new GeminiImageStepProvider(client as never, storage as never), client, storage, ...over };
  };

  it('generates, stores the bytes, and returns an image asset', async () => {
    const { p, client, storage } = make();
    const out = await p.execute({
      step: { prompt: 'a cat', model: 'gemini-2.5-flash-image' } as never,
      apiKey: 'k', priorResults: [], inputImages: [],
    });
    expect(client.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'k', model: 'gemini-2.5-flash-image', prompt: 'a cat', inputImages: [] }),
    );
    expect(storage.store).toHaveBeenCalledWith(expect.any(Buffer), 'image/png', expect.stringContaining('generated/'));
    expect(out.assets).toEqual([{ type: 'image', url: 'https://cdn/img.png', meta: expect.objectContaining({ role: 'generated', model: 'gemini-2.5-flash-image' }) }]);
  });

  it('passes input images through and marks the asset edited', async () => {
    const { p, client } = make();
    const out = await p.execute({
      step: { prompt: 'add a logo' } as never, apiKey: 'k', priorResults: [],
      inputImages: [{ url: 'u', mime: 'image/png', b64: 'BBB' }],
    });
    expect(client.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ inputImages: [{ url: 'u', mime: 'image/png', b64: 'BBB' }] }),
    );
    expect((out.assets?.[0].meta as { edited?: boolean }).edited).toBe(true);
  });

  it('throws without an api key', async () => {
    const { p } = make();
    await expect(p.execute({ step: { prompt: 'x' } as never, apiKey: '', priorResults: [] })).rejects.toThrow(/Google key/i);
  });
});
