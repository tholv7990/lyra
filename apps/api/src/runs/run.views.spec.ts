import { toState } from './run.views';

// Guards the reload path: an action step's kind/action and the structured ledger
// fields (evidence/sources/data) must survive doc → RunState mapping, or action
// steps get misdispatched and the RunLedger assembles empty across step calls.
describe('toState/toStep preserves action + structured fields on reload', () => {
  it('round-trips kind, action, evidence, sources, data', () => {
    const doc = {
      status: 'idle',
      currentStep: 0,
      steps: [
        {
          index: 0,
          mode: 'auto',
          status: 'done',
          model: 'm',
          prompt: 'p',
          kind: 'action',
          action: { type: 'unit-econ' },
          evidence: [{ id: 'c1', statement: 's', kind: 'estimate', sourceId: 's1' }],
          sources: [{ id: 's1', name: 'S', url: 'u', accessDate: 'd', primary: false, alive: true }],
          data: { unitEcon: { cm1: 5 } },
        },
      ],
    } as never;
    const state = toState(doc);
    const s = state.steps[0];
    expect(s.kind).toBe('action');
    expect(s.action).toEqual({ type: 'unit-econ' });
    expect(s.evidence).toHaveLength(1);
    expect(s.sources?.[0].id).toBe('s1');
    expect((s.data as { unitEcon?: { cm1: number } }).unitEcon).toEqual({ cm1: 5 });
  });
});
