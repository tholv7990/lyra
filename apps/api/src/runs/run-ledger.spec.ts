import { assembleLedger } from './run-ledger';
import type { Step } from '@lyra/shared';

const step = (over: Partial<Step>): Step => ({ index: 0, mode: 'auto' as never, status: 'done' as never, model: '', prompt: '', ...over });

describe('assembleLedger', () => {
  it('concats evidence, dedupes sources by id, merges data (later wins), parses econInputs from variables', () => {
    const steps: Step[] = [
      step({ index: 0, evidence: [{ id: 'c1', statement: 'a', kind: 'estimate', sourceId: 's1' }], sources: [{ id: 's1', name: 'S1', url: 'u1', accessDate: 'd', primary: false, alive: true }], data: { subScores: { x: 1 }, k: 'v1' } }),
      step({ index: 1, sources: [{ id: 's1', name: 'dupe', url: 'u1', accessDate: 'd', primary: false, alive: true }, { id: 's2', name: 'S2', url: 'u2', accessDate: 'd', primary: false, alive: true }], data: { k: 'v2', unitEcon: { cm1: 5 } } }),
    ];
    const led = assembleLedger(steps, { aov: '50', landedCost: '12', niche: 'dog toys' });
    expect(led.evidence).toHaveLength(1);
    expect(led.sources.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(led.data.k).toBe('v2');
    expect((led.data as any).unitEcon).toEqual({ cm1: 5 });
    expect(led.econInputs!.aov).toBe(50);
    expect(led.econInputs!.landedCost).toBe(12);
    expect(led.variables.niche).toBe('dog toys');
  });
  it('ignores non-numeric econ variables', () => {
    const led = assembleLedger([], { aov: 'abc' });
    expect(led.econInputs?.aov).toBeUndefined();
  });
});
