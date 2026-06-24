import { ValidationPlanAction } from './validation-plan.action';
import { Provider } from '@lyra/shared';
const ctx = (data: any = {}) => ({ action: { type: 'validation-plan' }, step: {} as any, workspaceId: 'ws', priorResults: [], ledger: { evidence: [{ id: 'c1', statement: 'demand is strong', kind: 'verified', sourceId: 's1' }], sources: [], data, variables: {} } }) as any;
const keys = { list: jest.fn().mockResolvedValue([{ provider: Provider.Anthropic }]), getDecrypted: jest.fn().mockResolvedValue('k') };
const json = '{"offer":"BOGO","landingPageHypothesis":"speed sells","creatives":["hook A","hook B"],"channel":"TikTok","decisionRule":"kill if CPA>maxCAC"}';

describe('ValidationPlanAction', () => {
  it('parses the plan and derives testBudget from maxCac', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: json }) };
    const out = await new ValidationPlanAction(client as never, client as never, keys as never).execute(ctx({ unitEcon: { maxCac: 20 } }));
    expect((out.data as any).validationPlan.offer).toBe('BOGO');
    expect((out.data as any).validationPlan.creatives).toEqual(['hook A', 'hook B']);
    expect((out.data as any).validationPlan.testBudget).toBe(500);
  });
  it('omits testBudget when maxCac<=0; degrades on bad JSON', async () => {
    const client = { complete: jest.fn().mockResolvedValue({ text: 'x' }) };
    const out = await new ValidationPlanAction(client as never, client as never, keys as never).execute(ctx({ unitEcon: { maxCac: 0 } }));
    expect((out.data as any).validationPlan.offer).toBe('');
    expect((out.data as any).validationPlan.creatives).toEqual([]);
    expect((out.data as any).validationPlan.testBudget).toBeUndefined();
  });
});
