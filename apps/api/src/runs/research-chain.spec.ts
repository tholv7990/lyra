import { assembleLedger } from './run-ledger';
import { DemandGateAction } from './providers/demand-gate.action';
import { ResolveInputsAction } from './providers/resolve-inputs.action';
import { CompetitionAction } from './providers/competition.action';
import { ScoreAction } from './providers/score.action';
import { UnitEconAction } from './providers/unit-econ.action';
import { RiskScreenAction } from './providers/risk-screen.action';
import { CustomerJobAction } from './providers/customer-job.action';
import { ReviewMiningAction } from './providers/review-mining.action';
import { CreativePotentialAction } from './providers/creative-potential.action';
import { SupplyChainAction } from './providers/supply-chain.action';
import { EvaluateAction } from './providers/evaluate.action';
import { ValidationPlanAction } from './providers/validation-plan.action';
import { SaveProductAction } from './providers/save-product.action';
import { Provider, WEIGHTS, StepKind, type Step } from '@lyra/shared';

const step = (over: Partial<Step>): Step => ({ index: 0, mode: 'auto' as never, status: 'done' as never, model: '', prompt: '', ...over });
const sig = (s: string) => ({ id: s, statement: 'demand up', kind: 'estimate' as const, sourceId: s, demandSignal: true });

// ScoreAction / CompetitionAction / RiskScreenAction with a mocked LLM returning mid scores for every dimension.
function scoreAction() {
  const json = JSON.stringify({ subScores: Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, 4])) });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new ScoreAction(client as never, client as never, keys as never);
}
function competitionAction() {
  const json = JSON.stringify({ competitors: [], marketType: 'emerging' });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new CompetitionAction(client as never, client as never, keys as never);
}
function riskScreenAction() {
  const json = JSON.stringify({ riskFlags: { unresolvedSafety: false, materialIpRisk: false, misleadingClaimsRequired: false }, riskNotes: [] });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new RiskScreenAction(client as never, client as never, keys as never);
}
function customerJobAction() {
  const json = JSON.stringify({ customer: 'buyer', job: 'get fit', problem: 'pain', alternative: 'nothing', trigger: 'summer' });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new CustomerJobAction(client as never, client as never, keys as never);
}
function reviewMiningAction() {
  const json = JSON.stringify({ complaints: [], desiredFeatures: [], objections: [] });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new ReviewMiningAction(client as never, client as never, keys as never);
}
function creativePotentialAction() {
  const json = JSON.stringify({ concepts: [{ hook: 'h', angle: 'a' }] });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new CreativePotentialAction(client as never, client as never, keys as never);
}
function supplyChainAction() {
  const json = JSON.stringify({ suppliers: [], certs: [], notes: [] });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new SupplyChainAction(client as never, client as never, keys as never);
}
function validationPlanAction() {
  const json = JSON.stringify({ offer: 'BOGO', landingPageHypothesis: 'speed sells', creatives: ['hook A'], channel: 'TikTok', decisionRule: 'kill if CPA>maxCAC' });
  const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
  const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
  return new ValidationPlanAction(client as never, client as never, keys as never);
}

describe('research pipeline chain', () => {
  const econVars = { aov: '50', landedCost: '12', paymentFeePct: '0.03', fulfillment: '4', shippingSubsidy: '2', expectedReturnLossPct: '0.05', warrantyReservePct: '0', desiredPostAdCmPct: '0.15' };

  it('research → gate → score → unit-econ → risk-screen → evaluate → save produces a Product with score/grade/decision', async () => {
    const steps: Step[] = [step({ index: 0, kind: StepKind.Action, evidence: [sig('s1'), sig('s2'), sig('s3')], sources: [
      { id: 's1', name: 'S1', url: 'u1', accessDate: 'd', primary: false, alive: true },
      { id: 's2', name: 'S2', url: 'u2', accessDate: 'd', primary: false, alive: true },
      { id: 's3', name: 'S3', url: 'u3', accessDate: 'd', primary: false, alive: true },
    ] })];
    // each step's run context, with the ledger assembled from PRIOR steps (engine-style):
    const run = (i: number) => ({ action: steps[i].action, step: steps[i], workspaceId: 'ws', projectId: 'p1', productId: 'prod-1', priorResults: [], ledger: assembleLedger(steps.slice(0, i), econVars) }) as any;

    steps.push(step({ index: 1, kind: StepKind.Action, action: { type: 'resolve-inputs' } as never }));
    steps[1].data = (await new ResolveInputsAction().execute(run(1))).data;
    steps.push(step({ index: 2, kind: StepKind.Action, action: { type: 'demand-gate' } as never }));
    steps[2].data = (await new DemandGateAction().execute(run(2))).data;
    steps.push(step({ index: 3, kind: StepKind.Action, action: { type: 'customer-job' } as never }));
    steps[3].data = (await customerJobAction().execute(run(3))).data;
    steps.push(step({ index: 4, kind: StepKind.Action, action: { type: 'review-mining' } as never }));
    steps[4].data = (await reviewMiningAction().execute(run(4))).data;
    steps.push(step({ index: 5, kind: StepKind.Action, action: { type: 'competition' } as never }));
    steps[5].data = (await competitionAction().execute(run(5))).data;
    steps.push(step({ index: 6, kind: StepKind.Action, action: { type: 'creative-potential' } as never }));
    steps[6].data = (await creativePotentialAction().execute(run(6))).data;
    steps.push(step({ index: 7, kind: StepKind.Action, action: { type: 'supply-chain' } as never }));
    steps[7].data = (await supplyChainAction().execute(run(7))).data;
    steps.push(step({ index: 8, kind: StepKind.Action, action: { type: 'score' } as never }));
    steps[8].data = (await scoreAction().execute(run(8))).data;
    steps.push(step({ index: 9, kind: StepKind.Action, action: { type: 'unit-econ' } as never }));
    steps[9].data = (await new UnitEconAction().execute(run(9))).data;
    steps.push(step({ index: 10, kind: StepKind.Action, action: { type: 'risk-screen' } as never }));
    steps[10].data = (await riskScreenAction().execute(run(10))).data;
    steps.push(step({ index: 11, kind: StepKind.Action, action: { type: 'evaluate' } as never }));
    steps[11].data = (await new EvaluateAction().execute(run(11))).data;
    steps.push(step({ index: 12, kind: StepKind.Action, action: { type: 'validation-plan' } as never }));
    steps[12].data = (await validationPlanAction().execute(run(12))).data;
    steps.push(step({ index: 13, kind: StepKind.Action, action: { type: 'save-product' } as never }));
    const products = { applyResearch: jest.fn().mockResolvedValue({ id: 'prod-1' }) };
    const out = await new SaveProductAction(products as never).execute(run(13));

    const saved = products.applyResearch.mock.calls[0][3];
    expect(saved.score).toBeGreaterThan(0);
    expect(saved.grade).toBeDefined();
    expect(saved.decision).toBeDefined();
    expect(saved.evidence).toHaveLength(3);
    expect(saved.assumptions).toBeDefined();
    expect(saved.riskFlags).toBeDefined();
    expect(saved.customerJob).toBeDefined();
    expect(saved.validationPlan).toBeDefined();
    expect((out.data as any).productId).toBe('prod-1');
  });

  it('stops at the demand gate with <3 signals (no Product saved)', async () => {
    const steps: Step[] = [step({ index: 0, evidence: [sig('s1')], sources: [] })];
    const ctx = { action: { type: 'demand-gate' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: assembleLedger(steps, {}) } as any;
    await expect(new DemandGateAction().execute(ctx)).rejects.toThrow(/demand signal/i);
  });
});
