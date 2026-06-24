import { RenderClient } from './render.client';

function client() {
  const config = { get: jest.fn().mockReturnValue('') } as never;
  return new RenderClient(config);
}

describe('RenderClient.review (fail-open)', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('returns the service verdict on a 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ pass: false, issues: ['image is blank'] }) }) as never;
    await expect(client().review({ assetUrl: 'https://x/a.png' })).resolves.toEqual({ pass: false, issues: ['image is blank'] });
  });

  it('fails OPEN (pass:true) when the service is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never;
    await expect(client().review({ assetUrl: 'https://x/a.png' })).resolves.toEqual({ pass: true, issues: [] });
  });

  it('fails OPEN (pass:true) on a 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as never;
    await expect(client().review({ assetUrl: 'https://x/a.png' })).resolves.toEqual({ pass: true, issues: [] });
  });
});
