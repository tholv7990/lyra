import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductStatus } from '@lyra/shared';
import { ProductDetailBody } from './ProductDetail';

const product = {
  id: 'x',
  workspaceId: 'w',
  projectId: 'p',
  name: 'Dog Toy',
  description: '',
  status: ProductStatus.Candidate,
  evidence: [{ id: 'c1', statement: '90-day search up 40%', kind: 'verified', sourceId: 's1', geography: 'US' }],
  sources: [{ id: 's1', name: 'Google Trends', url: 'https://t.co', accessDate: '2026-06-23', primary: true, alive: true }],
  unitEcon: { cm1: 28, cm1Pct: 0.56, breakEvenRoas: 1.78, maxCac: 20.5, targetRoas: 2.4 },
  score: 80,
  grade: 'B',
  decision: 'TEST_NOW',
  competitorIds: [],
  tags: [],
  active: true,
  createdBy: { id: 'u', name: 'U' },
  updatedBy: { id: 'u', name: 'U' },
  createdAt: '',
  updatedAt: '',
} as any;

describe('ProductDetail', () => {
  it('renders the evidence ledger: claims, sources, unit-econ, score/grade/decision', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody product={product} workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('90-day search up 40%');
    expect(html).toContain('verified');
    expect(html).toContain('Google Trends');
    expect(html).toContain('TEST_NOW');
    expect(html).toMatch(/28|56/);
  });

  it('omits unit-econ when absent (no zero-fill)', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody
        product={{ ...product, unitEcon: undefined, score: undefined }}
        workspaceId="w"
        onClose={() => {}}
        onUpdate={async () => {}}
        onProductRefresh={async () => {}}
      />,
    );
    expect(html).not.toMatch(/break-even/i);
  });
});
