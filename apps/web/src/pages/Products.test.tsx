import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
vi.mock('../workspace/useWorkspace', () => ({ useWorkspace: () => ({ current: { id: 'ws-1' } }) }));
vi.mock('../lib/products', () => ({ productsApi: { list: () => Promise.resolve([]), create: vi.fn(), update: vi.fn(), get: vi.fn(), remove: vi.fn() } }));

import { Products } from './Products';

describe('Products page', () => {
  it('renders the Products area with an Add product control', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Products /></MemoryRouter>);
    expect(html).toContain('Add product');
  });
});
