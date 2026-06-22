import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { BrandKitSection } from './BrandKitSection';

const noop = () => {};
const t = (k: string) => k; // returns the key, so we can assert keys appear

describe('BrandKitSection', () => {
  it('shows the brand label + an add-logo control when there is no logo', () => {
    const html = renderToStaticMarkup(
      <BrandKitSection brandKit={{}} uploading={false} onLogoFile={noop} onClearLogo={noop} onAccentChange={noop} t={t} />,
    );
    expect(html).toContain('projects.brandLabel');
    expect(html).toContain('projects.brandAddLogo');
    expect(html).toContain('type="file"');
    expect(html).toContain('type="color"');
  });

  it('shows the logo preview + clear control when a logo is set', () => {
    const html = renderToStaticMarkup(
      <BrandKitSection brandKit={{ logoUrl: 'https://x/logo.png' }} uploading={false} onLogoFile={noop} onClearLogo={noop} onAccentChange={noop} t={t} />,
    );
    expect(html).toContain('https://x/logo.png');
    expect(html).toContain('projects.brandClearLogo');
  });
});
