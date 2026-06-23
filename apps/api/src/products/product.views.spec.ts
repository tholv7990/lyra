import { toProductView } from './product.views';
import type { ProductDocument } from './product.schema';

describe('toProductView', () => {
  it('maps the workspace-pool + sourcing fields (round-trip, not write-only)', () => {
    const doc = {
      _id: { toString: () => 'p1' },
      workspaceId: 'ws-1',
      originatingProjectId: 'proj-9',
      name: 'Cozy bed',
      images: ['https://cdn/a.png', 'https://cdn/b.png'],
      price: 49.99,
      compareAtPrice: 79.99,
      offer: 'Buy 1 get 1',
      createdBy: 'u1',
      updatedBy: 'u1',
    } as unknown as ProductDocument;

    const view = toProductView(doc, new Map());

    expect(view.originatingProjectId).toBe('proj-9');
    expect(view.images).toEqual(['https://cdn/a.png', 'https://cdn/b.png']);
    expect(view.price).toBe(49.99);
    expect(view.compareAtPrice).toBe(79.99);
    expect(view.offer).toBe('Buy 1 get 1');
  });
});
