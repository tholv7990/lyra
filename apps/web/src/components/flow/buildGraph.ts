import type { Node, Edge } from '@xyflow/react';
import type { Asset, Run, Step, PipelineStep } from '@lyra/shared';
import type { StepHistoryEntry } from '../StepResultModal';

export const NODE_W = 280;
export const NODE_GAP = 96;
const Y = 0;
const x = (col: number) => col * (NODE_W + NODE_GAP);

// ---- run mode -------------------------------------------------------------
export interface RunNodeData {
  step: Step;
  input: string;
  inputLabel: string;
  locked: boolean;
  isCurrent: boolean;
  runId: string;
  assets: Asset[];
  history: StepHistoryEntry[];
  [key: string]: unknown;
}

export function buildRunGraph(opts: {
  run: Run;
  hasKey: (provider: string) => boolean;
  assets?: Asset[];
  historyForStep?: (index: number) => StepHistoryEntry[];
}): { nodes: Node[]; edges: Edge[] } {
  const { run, hasKey, assets = [], historyForStep } = opts;
  const provider = (s: Step) => s.provider ?? '';
  const nodes: Node[] = [{ id: 'cap-start', type: 'cap', position: { x: x(0), y: Y }, data: { kind: 'start' }, draggable: false }];

  run.steps.forEach((step, i) => {
    nodes.push({
      id: `run-${i}`,
      type: 'runStep',
      position: { x: x(i + 1), y: Y },
      data: {
        step,
        input: i > 0 ? run.steps[i - 1]?.result ?? '' : run.context?.note ?? '',
        inputLabel: i > 0 ? 'Input · from previous step' : 'Input · note',
        locked: !hasKey(provider(step)),
        isCurrent: step.index === run.currentStep && run.status !== 'done',
        runId: run.id,
        assets: assets.filter((a) => a.stepIndex === i),
        history: historyForStep?.(i) ?? [],
      } satisfies RunNodeData,
    });
  });

  nodes.push({ id: 'cap-end', type: 'cap', position: { x: x(run.steps.length + 1), y: Y }, data: { kind: 'end' }, draggable: false });
  return { nodes, edges: chainEdges(nodes, (i) => `run-${i}`, run.currentStep, run.status !== 'done') };
}

// ---- edit mode ------------------------------------------------------------
export interface EditNodeData {
  step: PipelineStep;
  index: number;
  canEdit: boolean;
  [key: string]: unknown;
}

export function buildEditGraph(opts: {
  steps: PipelineStep[];
  canEdit: boolean;
}): { nodes: Node[]; edges: Edge[] } {
  const { steps, canEdit } = opts;
  const nodes: Node[] = [{ id: 'cap-start', type: 'cap', position: { x: x(0), y: Y }, data: { kind: 'start' }, draggable: false }];

  steps.forEach((step, i) => {
    nodes.push({
      id: step.id,
      type: 'step',
      position: { x: x(i + 1), y: Y },
      data: { step, index: i, canEdit } satisfies EditNodeData,
    });
  });

  nodes.push({ id: 'cap-end', type: 'cap', position: { x: x(steps.length + 1), y: Y }, data: { kind: 'end' }, draggable: false });

  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'insert',
      data: { insertIndex: i },
    });
  }
  return { nodes, edges };
}

// ---- shared ---------------------------------------------------------------
function chainEdges(
  nodes: Node[],
  stepId: (i: number) => string,
  currentStep: number,
  liveAnim: boolean,
): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const target = nodes[i + 1];
    const isCurrentTarget = liveAnim && target.id === stepId(currentStep);
    edges.push({
      id: `e-${nodes[i].id}-${target.id}`,
      source: nodes[i].id,
      target: target.id,
      type: 'default',
      animated: isCurrentTarget,
    });
  }
  return edges;
}
