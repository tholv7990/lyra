import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });

import { ImageLightbox } from './ImageLightbox';

describe('ImageLightbox', () => {
  it('shows the first image + a "1 / N" counter + nav arrows for multiple images', () => {
    const html = renderToStaticMarkup(
      <ImageLightbox images={['https://x/1.png', 'https://x/2.png', 'https://x/3.png']} onClose={() => {}} />,
    );
    expect(html).toContain('https://x/1.png');
    expect(html).toContain('ilb-nav');
    expect(html).toContain('1 / 3');
  });

  it('shows no arrows/counter for a single image', () => {
    const html = renderToStaticMarkup(<ImageLightbox images={['https://x/only.png']} onClose={() => {}} />);
    expect(html).toContain('https://x/only.png');
    expect(html).not.toContain('ilb-nav');
  });

  it('renders nothing when there are no images', () => {
    const html = renderToStaticMarkup(<ImageLightbox images={[]} onClose={() => {}} />);
    expect(html).toBe('');
  });
});
