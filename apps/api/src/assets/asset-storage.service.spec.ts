// Mock sharp as a chainable stub that returns small bytes.
jest.mock('sharp', () => {
  const chain = {
    resize: () => chain,
    webp: () => chain,
    toBuffer: async () => Buffer.from('thumb'),
  };
  return jest.fn(() => chain);
});
import { AssetStorageService } from './asset-storage.service';

// Build the service in R2-enabled mode by faking ConfigService with the five R2_* vars.
const cfg = (vals: Record<string, string | undefined>) => ({ get: (k: string) => vals[k] }) as never;
const R2 = {
  R2_ENDPOINT: 'https://x.r2.cloudflarestorage.com', R2_ACCESS_KEY_ID: 'a',
  R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'b', R2_PUBLIC_URL: 'https://pub.r2.dev',
};

describe('AssetStorageService.storeImage', () => {
  it('stores a webp thumb alongside the image when R2 is enabled', async () => {
    const svc = new AssetStorageService(cfg(R2));
    const sendMock = jest.fn().mockResolvedValue({});
    (svc as unknown as { client: { send: typeof sendMock } }).client.send = sendMock;
    const out = await svc.storeImage(Buffer.from('img'), 'image/png', 'generated/x.png');
    expect(out.url).toBe('https://pub.r2.dev/generated/x.png');
    expect(out.thumbUrl).toBe('https://pub.r2.dev/thumbs/generated/x.png.webp');
    expect(sendMock).toHaveBeenCalledTimes(2); // full + thumb
  });

  it('skips the thumb on the data: fallback (no R2 configured)', async () => {
    const svc = new AssetStorageService(cfg({}));
    const out = await svc.storeImage(Buffer.from('img'), 'image/png', 'generated/x.png');
    expect(out.url.startsWith('data:image/png;base64,')).toBe(true);
    expect(out.thumbUrl).toBeUndefined();
  });
});
