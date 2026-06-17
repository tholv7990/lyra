import { describe, it, expect } from 'vitest';
import { RunStatus, StepStatus, StepMode, Provider } from '@lyra/shared';
import type { Run, Step, PipelineStep } from '@lyra/shared';
import { buildRunGraph, buildEditGraph, NODE_W, NODE_GAP } from './buildGraph';

function step(i: number, over: Partial<Step> = {}): Step {
  return {
    index: i, name: `S${i}`, promptId: `p${i}`, provider: 'anthropic',
    model: 'claude', prompt: 'do', mode: StepMode.Auto,
    status: StepStatus.Idle, result: '', error: '', ...over,
  } as Step;
}

const run = (steps: Step[], over: Partial<Run> = {}): Run => ({
  id: 'r1', workspaceId: 'w', status: RunStatus.Running, currentStep: 0,
  steps, ...over,
} as Run);

describe('buildRunGraph', () => {
  it('emits Start + steps + End nodes and connecting edges', () => {
    const g = buildRunGraph({ run: run([step(0), step(1)]), hasKey: () => true });
    expect(g.nodes.map((n) => n.id)).toEqual(['cap-start', 'run-0', 'run-1', 'cap-end']);
    expect(g.nodes).toHaveLength(4);
    expect(g.edges).toHaveLength(3);
  });

  it('lays nodes out left-to-right by order', () => {
    const g = buildRunGraph({ run: run([step(0), step(1)]), hasKey: () => true });
    const xs = g.nodes.map((n) => n.position.x);
    expect(xs).toEqual([0, NODE_W + NODE_GAP, 2 * (NODE_W + NODE_GAP), 3 * (NODE_W + NODE_GAP)]);
  });

  it('animates only the edge entering the current step', () => {
    const g = buildRunGraph({ run: run([step(0), step(1)], { currentStep: 1 }), hasKey: () => true });
    const animated = g.edges.filter((e) => e.animated).map((e) => e.target);
    expect(animated).toEqual(['run-1']);
  });

  it('marks the current step and locks steps with no provider key', () => {
    const g = buildRunGraph({ run: run([step(0)], { currentStep: 0 }), hasKey: () => false });
    const n = g.nodes.find((x) => x.id === 'run-0')!;
    expect(n.data.isCurrent).toBe(true);
    expect(n.data.locked).toBe(true);
  });

  it('feeds each step the previous step result as input', () => {
    const steps = [step(0, { result: 'A' }), step(1)];
    const g = buildRunGraph({ run: run(steps, { context: { note: 'seed' } as never }), hasKey: () => true });
    expect(g.nodes.find((n) => n.id === 'run-0')!.data.input).toBe('seed');
    expect(g.nodes.find((n) => n.id === 'run-1')!.data.input).toBe('A');
  });
});

describe('buildEditGraph', () => {
  it('emits Start + steps + End and edges carrying an insert index', () => {
    const steps: PipelineStep[] = [
      { id: 'a', name: 'A', promptId: 'p', provider: Provider.Anthropic, model: 'm', mode: StepMode.Auto },
      { id: 'b', name: 'B', promptId: 'p', provider: Provider.Anthropic, model: 'm', mode: StepMode.Gate },
    ];
    const g = buildEditGraph({ steps, canEdit: true });
    expect(g.nodes.map((n) => n.id)).toEqual(['cap-start', 'a', 'b', 'cap-end']);
    expect(g.edges.map((e) => e.data?.insertIndex)).toEqual([0, 1, 2]);
  });

  it('keeps step id as the node id so positions survive reorder', () => {
    const steps: PipelineStep[] = [{ id: 'x', name: 'X', promptId: 'p', provider: Provider.Anthropic, model: 'm', mode: StepMode.Auto }];
    const g = buildEditGraph({ steps, canEdit: false });
    expect(g.nodes.find((n) => n.type === 'step')!.id).toBe('x');
  });
});
