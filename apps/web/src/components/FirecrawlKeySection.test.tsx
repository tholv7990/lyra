import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Stub i18n — return the key so assertions match key names.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Stub workspace — component only reads current?.id.
vi.mock('../workspace/useWorkspace', () => ({
  useWorkspace: () => ({ current: { id: 'ws-1' } }),
}));

// Stub api — never actually called during static render.
vi.mock('../lib/api', () => ({
  api: vi.fn().mockResolvedValue({}),
}));

import { FirecrawlKeySection } from './FirecrawlKeySection';

describe('FirecrawlKeySection', () => {
  it('renders the Firecrawl key card', () => {
    const html = renderToStaticMarkup(<FirecrawlKeySection />);
    expect(html).toContain('Firecrawl');
  });
});
