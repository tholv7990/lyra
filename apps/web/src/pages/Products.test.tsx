import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Product } from '@lyra/shared';
import { ProductStatus } from '@lyra/shared';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
vi.mock('../workspace/useWorkspace', () => ({ useWorkspace: () => ({ current: { id: 'ws-1' } }) }));
vi.mock('../lib/products', () => ({ productsApi: { list: () => Promise.resolve([]), create: vi.fn(), update: vi.fn(), get: vi.fn(), remove: vi.fn() } }));
vi.mock('../lib/productRuns', () => ({ productRunsApi: { start: vi.fn(), list: vi.fn() } }));

import { Products } from './Products';
import { ProductDetailBody } from '../components/ProductDetail';

const STUB_PRODUCT: Product = {
  id: 'p-1',
  workspaceId: 'ws-1',
  name: 'Test Product',
  description: '',
  status: ProductStatus.Candidate,
  score: undefined,
  grade: undefined,
  decision: undefined,
  outcome: undefined,
  niche: undefined,
  category: undefined,
  price: undefined,
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

describe('Products page', () => {
  it('renders the Products area with an Add product control', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Products /></MemoryRouter>);
    expect(html).toContain('Add product');
  });
});

describe('ProductDetailBody', () => {
  it('shows a "Run research" control', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProductDetailBody
          product={STUB_PRODUCT}
          workspaceId="ws-1"
          onClose={() => {}}
          onUpdate={async () => {}}
          onProductRefresh={async () => {}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Run research');
  });
});
