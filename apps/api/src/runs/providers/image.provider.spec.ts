import { ImageStepProvider } from './image.provider';

describe('ImageStepProvider edit mode', () => {
  const storage = {
    store: jest.fn().mockResolvedValue('https://cdn/o.png'),
    storeImage: jest.fn().mockResolvedValue({ url: 'https://cdn/o.png', thumbUrl: 'https://cdn/o.thumb.webp' }),
  };
  const provider = () => new ImageStepProvider(storage as never);
  const okB64 = { ok: true, json: async () => ({ data: [{ b64_json: 'IMG' }] }) };

  afterEach(() => jest.restoreAllMocks());

  it('uses /images/edits with input images for gpt-image-1', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue(okB64 as never);
    await provider().execute({
      step: { prompt: 'add a logo', model: 'gpt-image-1' } as never, apiKey: 'k', priorResults: [],
      inputImages: [{ url: 'u', mime: 'image/png', b64: Buffer.from('x').toString('base64') }],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('stays on /images/generations for dall-e-3 even with input images', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue(okB64 as never);
    await provider().execute({
      step: { prompt: 'a cat', model: 'dall-e-3' } as never, apiKey: 'k', priorResults: [],
      inputImages: [{ url: 'u', mime: 'image/png', b64: Buffer.from('x').toString('base64') }],
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
  });

  it('generates (no edits) when there are no input images', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue(okB64 as never);
    await provider().execute({
      step: { prompt: 'a cat', model: 'gpt-image-1' } as never, apiKey: 'k', priorResults: [],
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
  });

  // Minor: dall-e-3 must append an operator-visible note when input images are
  // supplied but silently dropped (spec §6/§8 — "record a note in the result text").
  it('appends an input-ignored note to the result when dall-e-3 receives input images', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue(okB64 as never);
    const out = await provider().execute({
      step: { prompt: 'a cat', model: 'dall-e-3' } as never, apiKey: 'k', priorResults: [],
      inputImages: [{ url: 'u', mime: 'image/png', b64: Buffer.from('x').toString('base64') }],
    });
    expect(out.result).toContain('dall-e-3 ignores input images');
  });

  it('does NOT append the note when no input images are supplied', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue(okB64 as never);
    const out = await provider().execute({
      step: { prompt: 'a cat', model: 'dall-e-3' } as never, apiKey: 'k', priorResults: [],
    });
    expect(out.result).not.toContain('ignores input images');
  });
});
