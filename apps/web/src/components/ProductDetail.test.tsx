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

  it('shows assumptions and competition when present', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody
        product={{ ...product, assumptions: ['Assumed AOV $30 — no price set'], competition: { competitors: [{ name: 'Acme', price: '$39' }], marketType: 'dominated' } } as any}
        workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('Assumed AOV $30');
    expect(html).toContain('Acme');
    expect(html).toContain('dominated');
  });

  it('shows risk flags + notes and the sensitivity table', () => {
    const u = { cm1: 28, cm1Pct: 0.56, breakEvenRoas: 1.78, maxCac: 20.5, targetRoas: 2.4 };
    const html = renderToStaticMarkup(
      <ProductDetailBody
        product={{ ...product, riskFlags: { unresolvedSafety: false, materialIpRisk: true, misleadingClaimsRequired: false }, riskNotes: ['Branded character — IP risk'], scenarios: { base: u, low: u, high: u, plus10Cac: u, plus10Landed: u, doubleReturns: u } } as any}
        workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('Branded character');
    expect(html).toContain('Sensitivity');
  });

  it('shows the v2 evidence sections when present', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody product={{ ...product,
        customerJob: { customer: 'busy parents', job: 'keep kids busy', problem: 'boredom', alternative: 'TV', trigger: 'rainy day' },
        reviewMining: { complaints: ['too small'], desiredFeatures: ['bigger'], objections: [] },
        creativeConcepts: [{ hook: 'Never bored again', angle: 'relief' }],
        supplyChain: { suppliers: ['Acme Co'], certs: [], notes: ['MOQ unverified'] },
      } as any} workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('busy parents');
    expect(html).toContain('too small');
    expect(html).toContain('Never bored again');
    expect(html).toContain('Acme Co');
  });

  it('shows the validation plan when present', () => {
    const html = renderToStaticMarkup(
      <ProductDetailBody product={{ ...product, validationPlan: { offer: 'BOGO', landingPageHypothesis: 'speed sells', creatives: ['hook A'], channel: 'TikTok', testBudget: 500, decisionRule: 'kill if CPA>maxCAC' } } as any}
        workspaceId="w" onClose={() => {}} onUpdate={async () => {}} onProductRefresh={async () => {}} />,
    );
    expect(html).toContain('BOGO');
    expect(html).toContain('TikTok');
    expect(html).toContain('hook A');
  });
});
