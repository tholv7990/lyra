import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
vi.mock('../workspace/useWorkspace', () => ({ useWorkspace: () => ({ current: { id: 'ws-1' } }) }));
vi.mock('../lib/products', () => ({
  productsApi: { create: vi.fn(), importUrl: vi.fn() },
}));
vi.mock('../layout/breadcrumb', () => ({ useBreadcrumb: () => {}, useAppNav: () => () => {} }));

import { AddProduct } from './AddProduct';

describe('AddProduct import bar', () => {
  it('renders the Import bar with a URL input and a Sync button', () => {
    const html = renderToStaticMarkup(<MemoryRouter><AddProduct /></MemoryRouter>);
    expect(html).toContain('Import from a product link');
    expect(html).toContain('Sync');
    expect(html).toContain('ap-import');
    // URL input present (type="url" appears for both import + source — at least one)
    expect(html).toContain('type="url"');
  });
});
