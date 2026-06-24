import { RenderService } from './render.service';
import { RenderStore } from './render.store';
import sharp from 'sharp';

// Helper: build a fake Response wrapping a Buffer
function fakeResponse(buf: Buffer): Response {
  return {
    ok: true,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as Response;
}

describe('RenderService', () => {
  let service: RenderService;
  let mockStore: jest.Mocked<RenderStore>;

  beforeEach(() => {
    mockStore = {
      save: jest.fn().mockResolvedValue('http://localhost:9200/files/abc.png'),
    } as unknown as jest.Mocked<RenderStore>;
    service = new RenderService(mockStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should composite logo onto base image and return serve url', async () => {
    // Create tiny real PNGs in memory
    const basePng = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const logoPng = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    // Stub global.fetch to return these buffers
    const originalFetch = global.fetch;
    global.fetch = jest.fn(((url: string | URL | Request) => {
      if ((typeof url === 'string' && url.includes('logo')) || false) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => logoPng.buffer,
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => basePng.buffer,
      } as Response);
    }) as typeof fetch);

    try {
      const result = await service.renderImage({
        imageUrl: 'https://cdn/a.png',
        logoUrl: 'https://cdn/logo.png',
        position: 'br',
        size: 'md',
      });

      // Assert store.save was called once
      expect(mockStore.save).toHaveBeenCalledTimes(1);

      // Assert result contains the serve URL and correct dimensions
      expect(result.url).toBe('http://localhost:9200/files/abc.png');
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);

      // Assert the buffer passed to store.save is a valid PNG with correct dims
      const savedBuffer = mockStore.save.mock.calls[0][0] as Buffer;
      const metadata = await sharp(savedBuffer).metadata();
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
      expect(metadata.format).toBe('png');
    } finally {
      global.fetch = originalFetch;
    }
  });

  describe('review', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns pass:false + blank issue for a solid-color 512x512 image', async () => {
      const solidPng = await sharp({
        create: { width: 512, height: 512, channels: 3, background: { r: 200, g: 200, b: 200 } },
      })
        .png()
        .toBuffer();

      global.fetch = jest.fn().mockResolvedValue(fakeResponse(solidPng)) as unknown as typeof fetch;

      const result = await service.review({ assetUrl: 'https://cdn/solid.png' });

      expect(result.pass).toBe(false);
      expect(result.issues).toContain('image is blank or solid color');
    });

    it('returns pass:false + width/height issues for a 64x64 image', async () => {
      const tinyPng = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 100, g: 150, b: 200 } },
      })
        .png()
        .toBuffer();

      global.fetch = jest.fn().mockResolvedValue(fakeResponse(tinyPng)) as unknown as typeof fetch;

      const result = await service.review({ assetUrl: 'https://cdn/tiny.png' });

      expect(result.pass).toBe(false);
      expect(result.issues.some((i) => i.includes('width') && i.includes('< 256'))).toBe(true);
      expect(result.issues.some((i) => i.includes('height') && i.includes('< 256'))).toBe(true);
    });

    it('returns pass:false (no throw) for an undecodable buffer', async () => {
      const junk = Buffer.from('not an image at all');

      global.fetch = jest.fn().mockResolvedValue(fakeResponse(junk)) as unknown as typeof fetch;

      const result = await service.review({ assetUrl: 'https://cdn/junk.bin' });

      expect(result.pass).toBe(false);
      expect(result.issues).toContain('could not decode image');
    });

    it('returns pass:false with fetch issue when fetch fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

      const result = await service.review({ assetUrl: 'https://cdn/missing.png' });

      expect(result.pass).toBe(false);
      expect(result.issues).toContain('could not fetch asset');
    });

    it('returns pass:true for a 512x512 image with real pixel variance', async () => {
      // Build a gradient: left column dark (0), right column bright (255), creating high stdev
      const width = 512;
      const height = 512;
      const channels = 3;
      const raw = Buffer.alloc(width * height * channels);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * channels;
          const v = Math.floor((x / (width - 1)) * 255);
          raw[offset] = v;       // R
          raw[offset + 1] = v;   // G
          raw[offset + 2] = 255 - v; // B (varies inversely)
        }
      }
      const gradientPng = await sharp(raw, { raw: { width, height, channels } })
        .png()
        .toBuffer();

      global.fetch = jest.fn().mockResolvedValue(fakeResponse(gradientPng)) as unknown as typeof fetch;

      const result = await service.review({ assetUrl: 'https://cdn/gradient.png' });

      expect(result.pass).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});
