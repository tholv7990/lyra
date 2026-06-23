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

  it('explains the score: per-factor breakdown + decision reason', () => {
    const subScores = { demandIntent: 4, trendDurability: 3, problemIntensity: 3, whitespace: 4, unitEconomics: 1, creativePotential: 3, channelFit: 3, supplyQuality: 3, riskCompliance: 4, expansionValue: 2 };
    const hardGates = { unresolvedSafety: false, materialIpRisk: false, negativeUnitEcon: false, cpaExceedsMaxCac: false, singleSourceDemand: false, misleadingClaimsRequired: false };
    const html = renderToStaticMarkup(
      <ProductDetailBody
        product={{ ...product, subScores, hardGates, decision: 'RESOLVE_GAPS' } as any}
        workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('Unit economics');
    expect(html).toMatch(/floor: unitEconomics 1\/5/);
  });

  it('shows the unit-econ formula from stored inputs', () => {
    const unitEconInputs = { aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4, shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0, desiredPostAdCmPct: 0.15 };
    const html = renderToStaticMarkup(
      <ProductDetailBody product={{ ...product, unitEconInputs } as any} workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('Landed cost');
    expect(html).toMatch(/\$?12/);
  });

  it('marks insufficient evidence instead of inventing numbers (scored, but no evidence)', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody product={{ ...product, evidence: [] } as any} workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('Insufficient evidence');
  });

  it('shows "Not scored yet" when there are no sub-scores and no score', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody product={{ ...product, evidence: [], score: undefined, unitEcon: undefined, subScores: undefined } as any} workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('Not scored');
  });
});
