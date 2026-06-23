import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Product } from '@lyra/shared';
import { ProductStatus } from '@lyra/shared';

vi.stubGlobal('window', {
  matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
});

vi.mock('../workspace/useWorkspace', () => ({
  useWorkspace: () => ({ current: { id: 'ws-1' } }),
}));

vi.mock('../lib/products', () => ({
  productsApi: {
    list: () => Promise.resolve([]),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  projectProductsApi: {
    list: () => Promise.resolve([]),
    select: vi.fn(),
    refresh: vi.fn(),
    unselect: vi.fn(),
  },
}));

import { ProjectProducts } from './ProjectProducts';

const DRIFT_COPY: Product = {
  id: 'copy-1',
  workspaceId: 'ws-1',
  poolProductId: 'pool-1',
  drift: true,
  name: 'Drifted Widget',
  description: '',
  status: ProductStatus.Candidate,
  score: undefined,
  grade: undefined,
  decision: undefined,
  outcome: undefined,
  niche: undefined,
  category: undefined,
  price: 9.99,
  compareAtPrice: undefined,
  offer: undefined,
  sources: [],
  evidence: [],
  images: [],
  unitEcon: undefined,
  competitorIds: [],
  tags: [],
  active: true,
  createdBy: { id: 'u-1', name: 'Alice' },
  updatedBy: { id: 'u-1', name: 'Alice' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProjectProducts', () => {
  it('renders the section heading', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProjectProducts projectId="p1" workspaceId="ws1" />
      </MemoryRouter>,
    );
    // Section heading key: projects.products.title = 'Products'
    expect(html).toContain('Products');
  });

  it('renders a copy card with name and drift/refresh affordances when a drifted copy is present', () => {
    // We test the static render with a pre-seeded copies list by passing
    // initialCopies prop (test-only).
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProjectProducts projectId="p1" workspaceId="ws1" initialCopies={[DRIFT_COPY]} />
      </MemoryRouter>,
    );
    // Copy name renders
    expect(html).toContain('Drifted Widget');
    // Drift badge renders (key: projects.products.drift = 'Outdated')
    expect(html).toContain('Outdated');
    // Refresh button renders (key: projects.products.refresh = 'Refresh')
    expect(html).toContain('Refresh');
  });

  it('renders empty state when there are no copies', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProjectProducts projectId="p1" workspaceId="ws1" initialCopies={[]} />
      </MemoryRouter>,
    );
    // Empty state key: projects.products.empty = 'No products selected yet.'
    expect(html).toContain('No products selected yet.');
  });
});
