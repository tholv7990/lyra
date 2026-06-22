import { BrandActionProvider } from './brand.action';
import { ActionType, Corner } from '@lyra/shared';
import type { ActionRunContext } from './action-provider.interface';

const render = { renderImage: jest.fn() };
const ctx = (over = {}): ActionRunContext => ({
  action: { type: ActionType.Brand, position: Corner.BR, size: 'md' as const },
  step: { index: 1, mode: 'auto', status: 'running', model: '', prompt: 'https://cdn/a.png' } as any,
  workspaceId: 'w1',
  priorResults: [],
  brandKit: { logoUrl: 'https://cdn/logo.png' },
  ...over,
});

describe('BrandActionProvider', () => {
  beforeEach(() => render.renderImage.mockReset());

  it('renders the prior image with the project logo and returns an image asset', async () => {
    render.renderImage.mockResolvedValue({ url: 'https://cdn/out.png', width: 1080, height: 1080 });
    const out = await new BrandActionProvider(render as any).execute(ctx());
    expect(render.renderImage).toHaveBeenCalledWith({
      imageUrl: 'https://cdn/a.png',
      logoUrl: 'https://cdn/logo.png',
      position: 'br',
      size: 'md',
    });
    expect(out.assets).toEqual([{ type: 'image', url: 'https://cdn/out.png' }]);
  });

  it('throws when the project has no logo', async () => {
    await expect(new BrandActionProvider(render as any).execute(ctx({ brandKit: {} })))
      .rejects.toThrow(/logo/i);
  });
});
