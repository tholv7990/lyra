import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
vi.mock('../workspace/useWorkspace', () => ({ useWorkspace: () => ({ current: { id: 'ws-1' } }) }));
vi.mock('../lib/products', () => ({
  productsApi: { create: vi.fn(), update: vi.fn(), get: vi.fn(), importUrl: vi.fn() },
}));
vi.mock('../layout/breadcrumb', () => ({ useBreadcrumb: () => {}, useAppNav: () => () => {} }));

import { ProductEditor } from './ProductEditor';

describe('ProductEditor (create mode)', () => {
  it('renders the Import bar + the three numbered panels incl. Description', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ProductEditor /></MemoryRouter>);
    // Create mode (no :id) → import bar present
    expect(html).toContain('Import from a product link');
    expect(html).toContain('ap-import');
    expect(html).toContain('Sync');
    // The form fields (incl. the new Description field)
    expect(html).toContain('Description');
    expect(html).toContain('type="url"');
  });
});
