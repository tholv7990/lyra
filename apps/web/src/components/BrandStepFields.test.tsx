import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { BrandStepFields } from './BrandStepFields';
import { ActionType, Corner } from '@lyra/shared';

const t = (k: string) => k;
describe('BrandStepFields', () => {
  it('renders the position grid + size control, with the current selection marked', () => {
    const html = renderToStaticMarkup(
      <BrandStepFields action={{ type: ActionType.Brand, position: Corner.BR, size: 'md' }} onChange={() => {}} t={t} />,
    );
    expect(html).toContain('pipelines.brandPosition');
    expect(html).toContain('pipelines.brandSize');
    expect(html).toContain('pipelines.brandSize_md');
    expect(html).toContain('aria-pressed="true"'); // the selected corner/size
    expect(html).toContain('brand-corner'); // the grid rendered
  });
});
