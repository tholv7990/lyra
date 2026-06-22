import { GeminiClient } from './gemini.client';

describe('GeminiClient.generateImage', () => {
  const okResponse = (b64: string) => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }],
    }),
  });

  afterEach(() => jest.restoreAllMocks());

  it('posts prompt + input images and returns the inline image', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue(okResponse('AAA') as never);
    const out = await new GeminiClient().generateImage({
      apiKey: 'k', model: 'gemini-2.5-flash-image', prompt: 'a cat',
      inputImages: [{ url: 'u', mime: 'image/png', b64: 'BBB' }],
    });
    expect(out).toEqual({ b64: 'AAA', mime: 'image/png' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('gemini-2.5-flash-image:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(init.body as string);
    const parts = body.contents[0].parts;
    expect(parts[0]).toEqual({ text: 'a cat' });
    expect(parts[1].inlineData).toEqual({ mimeType: 'image/png', data: 'BBB' });
  });

  it('throws a clean error (no key) on non-2xx', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: false, status: 403, text: async () => 'denied' } as never);
    await expect(
      new GeminiClient().generateImage({ apiKey: 'secret', model: 'gemini-2.5-flash-image', prompt: 'x', inputImages: [] }),
    ).rejects.toThrow(/gemini.*403/i);
  });

  it('throws when the response has no image part', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'no image' }] } }] }),
    } as never);
    await expect(
      new GeminiClient().generateImage({ apiKey: 'k', model: 'gemini-2.5-flash-image', prompt: 'x', inputImages: [] }),
    ).rejects.toThrow(/no image/i);
  });
});
