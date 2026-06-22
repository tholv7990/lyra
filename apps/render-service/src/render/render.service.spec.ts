import { RenderService } from './render.service';
import { RenderStore } from './render.store';
import sharp from 'sharp';

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
});
