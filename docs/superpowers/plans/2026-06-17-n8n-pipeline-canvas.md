# n8n-style Pipeline Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Lyra's pipeline builder + run view as an n8n-style React Flow canvas (horizontal node cards, bezier wires, dotted grid, pan/zoom/drag) over the **existing linear chain** — front-end only, no backend or data-model change.

**Architecture:** A pure `buildGraph` module maps the linear `Step[]` / `PipelineStep[]` array to React Flow `{nodes, edges}` (this is the unit-tested part). A thin `FlowCanvas` component renders that graph with React Flow on **desktop** for both surfaces; **mobile keeps the existing `FlowPager` untouched**. Node cards are extracted from today's inline markup so canvas + pager share them. Callbacks reach node components via a small React context so `buildGraph` stays pure and testable.

**Tech Stack:** React 19, Vite 8, `@xyflow/react` v12 (React Flow), Vitest (node env for logic tests), existing `@lyra/shared` types.

---

## Conventions for this plan

- **COMMITS ARE HELD.** Per the user's instruction ("don't commit/push unless I ask"), **do not run `git commit`**. Each task ends with a **Checkpoint** (run the gate command, confirm green). Staging with `git add` is fine; the user will commit when they choose.
- Spec: [docs/superpowers/specs/2026-06-17-n8n-pipeline-canvas-design.md](../specs/2026-06-17-n8n-pipeline-canvas-design.md).
- Test mechanism refinement vs spec §9: instead of RTL rendering assertions (jsdom-flaky for React Flow), we unit-test the **pure `buildGraph`** functions. Same coverage of the array→graph mapping, far more robust.
- React Flow `nodeTypes` object must be **module-level constant** (not re-created per render) or React Flow warns/re-mounts.

---

## File structure

| File | Responsibility | New/Modify |
|---|---|---|
| `apps/web/package.json` | add `@xyflow/react` dep | Modify |
| `apps/web/src/main.tsx` | import `@xyflow/react/dist/style.css` | Modify |
| `apps/web/src/components/flow/buildGraph.ts` | **pure** array→`{nodes,edges}` mapping (run + edit) | Create |
| `apps/web/src/components/flow/buildGraph.test.ts` | node-env unit tests for the mapping | Create |
| `apps/web/src/components/flow/flowCallbacks.tsx` | React context carrying per-mode callbacks to nodes | Create |
| `apps/web/src/components/flow/CapNode.tsx` | Start/End cap node | Create |
| `apps/web/src/components/flow/RunStepNode.tsx` | run-mode node wrapper (handles + `RunStepCard`) | Create |
| `apps/web/src/components/flow/StepNode.tsx` | edit-mode node wrapper (handles + `StepCard`) | Create |
| `apps/web/src/components/RunStepCard.tsx` | run card body (extracted from `RunFlow.RunNode`) | Create |
| `apps/web/src/components/StepCard.tsx` | edit card body (extracted from `PipelineBuilder.renderNode`) | Create |
| `apps/web/src/components/FlowCanvas.tsx` | React Flow wrapper (edit + run), lazy-loaded | Create |
| `apps/web/src/components/RunFlow.tsx` | desktop branch → `FlowCanvas`; mobile pager reuses `RunStepCard` | Modify |
| `apps/web/src/pages/PipelineBuilder.tsx` | desktop branch → `FlowCanvas`; pager reuses `StepCard` | Modify |
| `apps/web/src/layout/layout.css` | canvas/node theming overrides (after line ~3271) | Modify |

---

## Phase A — Shared graph logic + run view on canvas

### Task 1: Add React Flow

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Install the dependency**

Run: `pnpm --filter @lyra/web add @xyflow/react@^12`
Expected: `@xyflow/react` appears under `dependencies` in `apps/web/package.json`.

- [ ] **Step 2: Import the base stylesheet once**

In `apps/web/src/main.tsx`, add near the other CSS imports (keep it **above** the app's own CSS so our overrides win):

```ts
import '@xyflow/react/dist/style.css';
```

- [ ] **Step 3: Checkpoint**

Run: `pnpm --filter @lyra/web build`
Expected: build succeeds. (No UI change yet.) Do **not** commit.

---

### Task 2: Pure graph builder + tests

**Files:**
- Create: `apps/web/src/components/flow/buildGraph.ts`
- Test: `apps/web/src/components/flow/buildGraph.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/flow/buildGraph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RunStatus, StepStatus, StepMode } from '@lyra/shared';
import type { Run, Step } from '@lyra/shared';
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
    expect(g.nodes).toHaveLength(4);          // N + 2
    expect(g.edges).toHaveLength(3);          // N + 1
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
    const steps = [
      { id: 'a', name: 'A', promptId: 'p', provider: 'anthropic', model: 'm', mode: StepMode.Auto },
      { id: 'b', name: 'B', promptId: 'p', provider: 'anthropic', model: 'm', mode: StepMode.Gate },
    ];
    const g = buildEditGraph({ steps, canEdit: true });
    expect(g.nodes.map((n) => n.id)).toEqual(['cap-start', 'a', 'b', 'cap-end']);
    // 3 edges, each can insert a step at index 0,1,2
    expect(g.edges.map((e) => e.data?.insertIndex)).toEqual([0, 1, 2]);
  });

  it('keeps step id as the node id so positions survive reorder', () => {
    const steps = [{ id: 'x', name: 'X', promptId: 'p', provider: 'anthropic', model: 'm', mode: StepMode.Auto }];
    const g = buildEditGraph({ steps, canEdit: false });
    expect(g.nodes.find((n) => n.type === 'step')!.id).toBe('x');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @lyra/web test -- buildGraph`
Expected: FAIL — `Cannot find module './buildGraph'`.

- [ ] **Step 3: Implement the builder**

Create `apps/web/src/components/flow/buildGraph.ts`:

```ts
import type { Node, Edge } from '@xyflow/react';
import { StepStatus } from '@lyra/shared';
import type { Run, Step, PipelineStep } from '@lyra/shared';

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
  [key: string]: unknown;
}

export function buildRunGraph(opts: {
  run: Run;
  hasKey: (provider: string) => boolean;
}): { nodes: Node[]; edges: Edge[] } {
  const { run, hasKey } = opts;
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

  // one edge per gap; data.insertIndex = where a + would insert a new step
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'default',
      data: { insertIndex: i }, // gap before step i  → 0..steps.length
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
```

> Note: `Step` already carries `result`/`status`/`mode`; `StepStatus` import keeps the file ready for any status-derived styling. If lint flags `StepStatus` as unused, remove the import.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @lyra/web test -- buildGraph`
Expected: PASS (all cases).

- [ ] **Step 5: Checkpoint**

Run: `pnpm --filter @lyra/web type-check`
Expected: no errors. Do not commit.

---

### Task 3: Extract `RunStepCard` (pure refactor, behavior unchanged)

**Files:**
- Create: `apps/web/src/components/RunStepCard.tsx`
- Modify: `apps/web/src/components/RunFlow.tsx:99-190`

- [ ] **Step 1: Move the `RunNode` body into its own file**

Create `apps/web/src/components/RunStepCard.tsx` and **move** the entire `RunNode` function from `RunFlow.tsx` (currently lines 99–190) into it, plus the small helpers it needs (`STATUS_LABEL`, `stepTitle`, `providerOf`). Export it and rename to `RunStepCard`. Keep the **exact JSX and logic** — only the location and name change:

```tsx
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { STEP_DEFS, STEP_PROVIDERS, StepMode, StepStatus, tagColor, type Step } from '@lyra/shared';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle', queued: 'Queued', running: 'Running',
  waiting: 'Awaiting approval', done: 'Done', error: 'Error',
};
function stepTitle(step: Step) {
  return step.name?.trim() || STEP_DEFS[step.index]?.title || `Step ${step.index + 1}`;
}
function providerOf(step: Step): string {
  return step.provider ?? (step.key ? STEP_PROVIDERS[step.key] : '') ?? '';
}

export interface RunStepCardProps {
  step: Step;
  input: string;
  inputLabel: string;
  locked: boolean;
  isCurrent: boolean;
  busy: boolean;
  onRun: () => void;
  onApprove: () => void;
  onSavePrompt: (prompt: string) => void;
}

export function RunStepCard(props: RunStepCardProps) {
  // …paste the body of the old RunNode verbatim (lines 110–189 of the old RunFlow.tsx)…
}
```

(The body — `isGate`, `expanded`, `draft`/`dirty`, the `.flow-node run …` markup, inline Run/Approve, expandable input/prompt/result — is copied **unchanged** from the original `RunNode`.)

- [ ] **Step 2: Re-point `RunFlow.tsx` at the extracted card**

In `RunFlow.tsx`: delete the now-moved `RunNode`, `STATUS_LABEL`, `stepTitle`, `providerOf`, and add `import { RunStepCard } from './RunStepCard';`. Update the `node()` helper to render `RunStepCard` (same props — it already passes them). `providerOf` is still needed in `RunFlow` for `locked={!hasKey(providerOf(step))}`; **keep a copy** there or import it from `RunStepCard` (export it). Simplest: `export function providerOf` from `RunStepCard` and import it.

- [ ] **Step 3: Verify nothing broke**

Run: `pnpm --filter @lyra/web type-check && pnpm --filter @lyra/web build`
Expected: green. The run view still renders identically (vertical) at this point.

- [ ] **Step 4: Checkpoint** — do not commit.

---

### Task 4: Node wrappers + callback context

**Files:**
- Create: `apps/web/src/components/flow/flowCallbacks.tsx`
- Create: `apps/web/src/components/flow/CapNode.tsx`
- Create: `apps/web/src/components/flow/RunStepNode.tsx`

- [ ] **Step 1: Callback context**

Create `apps/web/src/components/flow/flowCallbacks.tsx`:

```tsx
import { createContext, useContext } from 'react';

export interface FlowCallbacks {
  busy: boolean;
  // run mode
  onRunStep?: (index: number) => void;
  onApprove?: (index: number) => void;
  onSavePrompt?: (index: number, prompt: string) => void;
  // edit mode
  onEdit?: (index: number) => void;
  onToggleMode?: (index: number) => void;
  onMove?: (index: number, dir: -1 | 1) => void;
  onRemove?: (index: number) => void;
  onInsert?: (index: number) => void;
  onViewPrompt?: (promptId: string) => void;
}

const Ctx = createContext<FlowCallbacks>({ busy: false });
export const FlowCallbacksProvider = Ctx.Provider;
export const useFlowCallbacks = () => useContext(Ctx);
```

- [ ] **Step 2: Cap node**

Create `apps/web/src/components/flow/CapNode.tsx`:

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';

export function CapNode({ data }: NodeProps) {
  const kind = (data as { kind: 'start' | 'end' }).kind;
  return (
    <div className={`flow-cap ${kind === 'end' ? 'end' : ''}`}>
      {kind === 'start' ? '● Start' : '◉ End'}
      {kind === 'start'
        ? <Handle type="source" position={Position.Right} isConnectable={false} />
        : <Handle type="target" position={Position.Left} isConnectable={false} />}
    </div>
  );
}
```

- [ ] **Step 3: Run step node**

Create `apps/web/src/components/flow/RunStepNode.tsx`:

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { RunStepCard } from '../RunStepCard';
import { useFlowCallbacks } from './flowCallbacks';
import type { RunNodeData } from './buildGraph';

export function RunStepNode({ data }: NodeProps) {
  const d = data as RunNodeData;
  const cb = useFlowCallbacks();
  const i = d.step.index;
  return (
    <div className="flow-rf-node">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <RunStepCard
        step={d.step}
        input={d.input}
        inputLabel={d.inputLabel}
        locked={d.locked}
        isCurrent={d.isCurrent}
        busy={cb.busy}
        onRun={() => cb.onRunStep?.(i)}
        onApprove={() => cb.onApprove?.(i)}
        onSavePrompt={(p) => cb.onSavePrompt?.(i, p)}
      />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
```

- [ ] **Step 4: Checkpoint**

Run: `pnpm --filter @lyra/web type-check`
Expected: green (components compile; not wired yet). Do not commit.

---

### Task 5: `FlowCanvas` (run mode) + wire `RunFlow` desktop

**Files:**
- Create: `apps/web/src/components/FlowCanvas.tsx`
- Modify: `apps/web/src/components/RunFlow.tsx:84-96`

- [ ] **Step 1: Build `FlowCanvas` (run mode supported now; edit mode hook ready)**

Create `apps/web/src/components/FlowCanvas.tsx`:

```tsx
import { useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls,
  Panel, useNodesState, useEdgesState, useReactFlow, type Node, type Edge,
} from '@xyflow/react';
import type { Run } from '@lyra/shared';
import { buildRunGraph } from './flow/buildGraph';
import { CapNode } from './flow/CapNode';
import { RunStepNode } from './flow/RunStepNode';
import { StepNode } from './flow/StepNode';
import { FlowCallbacksProvider, type FlowCallbacks } from './flow/flowCallbacks';

// MODULE-LEVEL constant — React Flow requires a stable nodeTypes reference.
const nodeTypes = { cap: CapNode, runStep: RunStepNode, step: StepNode };

export interface FlowCanvasProps {
  graph: { nodes: Node[]; edges: Edge[] };
  callbacks: FlowCallbacks;
}

function Canvas({ graph, callbacks }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const { fitView } = useReactFlow();

  // Re-derive when the source graph changes (status, reorder, insert/remove).
  // Preserve any user-dragged position by node id; new/removed nodes follow layout.
  useEffect(() => {
    setNodes((prev) => {
      const pos = new Map(prev.map((n) => [n.id, n.position]));
      return graph.nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }));
    });
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  const tidy = () => {
    setNodes((prev) => prev.map((n) => {
      const src = graph.nodes.find((g) => g.id === n.id);
      return src ? { ...n, position: src.position } : n;
    }));
    requestAnimationFrame(() => fitView({ duration: 250 }));
  };

  return (
    <FlowCallbacksProvider value={callbacks}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <button type="button" className="btn-ghost flow-tidy" onClick={tidy}>Tidy</button>
        </Panel>
      </ReactFlow>
    </FlowCallbacksProvider>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <div className="flow-canvas">
      <ReactFlowProvider>
        <Canvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}

// Helper so callers don't import buildRunGraph + FlowCanvas separately.
export function runGraph(run: Run, hasKey: (p: string) => boolean) {
  return buildRunGraph({ run, hasKey });
}
```

> If `StepNode` isn't created yet when you compile, temporarily stub it (Task 8 fills it in); or do Task 8 before this step. Recommended order: do Task 8's StepNode file first as an empty passthrough, then complete it later.

- [ ] **Step 2: Lazy-load + render on desktop in `RunFlow`**

In `RunFlow.tsx`, add at top:

```tsx
import { lazy, Suspense } from 'react';
import { runGraph } from './FlowCanvas';
const FlowCanvas = lazy(() => import('./FlowCanvas'));
```

Replace the **desktop** `return (<div className="flow run-flow">…</div>)` block (lines ~84–96) with:

```tsx
  const graph = runGraph(run, hasKey);
  return (
    <Suspense fallback={<div className="flow-canvas loading">Loading canvas…</div>}>
      <FlowCanvas
        graph={graph}
        callbacks={{ busy, onRunStep, onApprove, onSavePrompt }}
      />
    </Suspense>
  );
```

Leave the **mobile** `if (isMobile) { … pager … }` block exactly as-is (it already uses `node()` → `RunStepCard`).

- [ ] **Step 3: Manual verification (no automated test — React Flow needs real layout)**

Run: `pnpm dev`, open a project, start a run on **desktop width**.
Expected: horizontal canvas, dotted grid, Start/End caps, node cards joined by curved wires; the wire into the running step animates; pan/zoom/Tidy work; Run/Approve still function. Resize narrow → mobile pager still works.

- [ ] **Step 4: Checkpoint**

Run: `pnpm --filter @lyra/web type-check && pnpm --filter @lyra/web test`
Expected: green. Do not commit.

---

### Task 6: Canvas theming

**Files:**
- Modify: `apps/web/src/layout/layout.css` (append after line ~3271)

- [ ] **Step 1: Add canvas + node overrides**

Append to `layout.css`:

```css
/* ===== n8n-style React Flow canvas ===== */
.flow-canvas { width: 100%; height: 70vh; min-height: 480px; }
.flow-canvas.loading { display: grid; place-items: center; color: var(--muted); }
.react-flow__attribution { display: none; }
/* let our card styles show through React Flow's node chrome */
.react-flow__node { background: transparent; border: 0; padding: 0; box-shadow: none; width: 280px; }
.react-flow__node .flow-node,
.react-flow__node .flow-cap { margin: 0; }
.react-flow__handle { width: 8px; height: 8px; background: var(--border); border: 0; }
.react-flow__edge-path { stroke: var(--border); stroke-width: 1.5; }
.react-flow__edge.animated .react-flow__edge-path { stroke: var(--primary); }
.flow-tidy { width: auto; margin: 0; padding: 4px 10px; font-size: 13px; }
```

- [ ] **Step 2: Verify** — reload `pnpm dev` desktop run view; cards match Lyra's look, orange only on the animated/current wire.

- [ ] **Step 3: Checkpoint** — `pnpm --filter @lyra/web build`. Do not commit.

---

## Phase B — Builder on canvas

### Task 7: Extract `StepCard` (pure refactor)

**Files:**
- Create: `apps/web/src/components/StepCard.tsx`
- Modify: `apps/web/src/pages/PipelineBuilder.tsx:344-420`

- [ ] **Step 1: Create `StepCard` from `renderNode`**

Move the JSX currently produced by `renderNode` (lines 344–420) into `StepCard.tsx`. Replace the closure variables with explicit props; the body markup (grip optional, head with `flow-num`/`flow-name`/mode toggle/eye, snippet, sub, foot tags + author, ↑/↓/× actions) is copied **unchanged** except wiring callbacks to props:

```tsx
import type { CSSProperties } from 'react';
import { StepMode, tagColor, labelColor, Provider, type PipelineStep, type Prompt, type Label } from '@lyra/shared';
import { EyeIcon } from '../layout/icons';
import { useFlowCallbacks } from './flow/flowCallbacks';

const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI', [Provider.Anthropic]: 'Anthropic', [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image', [Provider.Video]: 'Video',
};

export interface StepCardProps {
  step: PipelineStep;
  index: number;
  canEdit: boolean;
  prompt?: Prompt;
  labels: Label[];
  modelLabel: (p: Provider, m: string) => string;
  onCanvas?: boolean; // hide ↑/↓ drag-reorder grip on canvas (reorder via ←/→ actions)
}

export function StepCard(props: StepCardProps) {
  const { step: s, index: i, canEdit, prompt: p, labels, modelLabel } = props;
  const cb = useFlowCallbacks();
  // …paste the renderNode markup here, replacing:
  //   openEdit(i)      → cb.onEdit?.(i)
  //   toggleMode(i)    → cb.onToggleMode?.(i)
  //   setDetailPrompt(p) → cb.onViewPrompt?.(p.id)
  //   move(i, -1/1)    → cb.onMove?.(i, -1/1)
  //   removeStep(i)    → cb.onRemove?.(i)
  //   tagColor/labelColor/PROVIDER_LABELS/modelLabel as above
  // Drag grip (flow-grip / startDrag) is OMITTED — reordering is via the ←/→ actions.
}
```

- [ ] **Step 2: Re-point the builder's mobile pager at `StepCard`**

In `PipelineBuilder.tsx`, replace the inline `renderNode` with a thin wrapper that renders `<StepCard …>` wrapped in the `FlowCallbacksProvider` (so the pager and canvas share one callback path). Supply callbacks bound to the existing handlers (`openEdit`, `toggleMode`, `move`, `removeStep`, `setDetailPrompt`). Keep the desktop drag-reorder grip working in the **pager** path only if needed; on canvas it's replaced by ←/→.

- [ ] **Step 3: Verify** — `pnpm --filter @lyra/web type-check && build`; builder still renders (vertical) and edits work.

- [ ] **Step 4: Checkpoint** — do not commit.

---

### Task 8: `StepNode` wrapper

**Files:**
- Create: `apps/web/src/components/flow/StepNode.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { StepCard } from '../StepCard';
import { useFlowCallbacks } from './flowCallbacks';
import type { EditNodeData } from './buildGraph';

export function StepNode({ data }: NodeProps) {
  const d = data as EditNodeData & {
    prompt?: import('@lyra/shared').Prompt;
    labels: import('@lyra/shared').Label[];
    modelLabel: (p: import('@lyra/shared').Provider, m: string) => string;
  };
  return (
    <div className="flow-rf-node">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <StepCard step={d.step} index={d.index} canEdit={d.canEdit} prompt={d.prompt}
                labels={d.labels} modelLabel={d.modelLabel} onCanvas />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
```

> `buildEditGraph` must attach `prompt`, `labels`, `modelLabel` to each step node's `data`. Update `buildEditGraph` opts to accept `prompts`, `labels`, `modelLabel` and resolve `prompt` per step. Extend the Task 2 test to assert `data.prompt` is the matched prompt. (Add these params; keep the existing assertions passing.)

- [ ] **Step 2: Checkpoint** — `type-check`. Do not commit.

---

### Task 9: Wire builder desktop → `FlowCanvas` (edit mode)

**Files:**
- Modify: `apps/web/src/pages/PipelineBuilder.tsx:537-551`
- Modify: `apps/web/src/components/flow/buildGraph.ts` (edit edge `+` insert wiring already present)

- [ ] **Step 1: Add an `InsertEdge` for the `+` button**

Create a custom edge component `apps/web/src/components/flow/InsertEdge.tsx` that draws the bezier path and a centered `+` button calling `cb.onInsert?.(data.insertIndex)`:

```tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useFlowCallbacks } from './flowCallbacks';

export function InsertEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath(props);
  const cb = useFlowCallbacks();
  const insertIndex = (props.data as { insertIndex: number } | undefined)?.insertIndex;
  return (
    <>
      <BaseEdge id={props.id} path={path} />
      {cb.onInsert && insertIndex != null && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="flow-add nodrag nopan"
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
            title="Add step"
            onClick={() => cb.onInsert!(insertIndex)}
          >+</button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
```

Register it in `FlowCanvas` as `edgeTypes` (module-level const): `const edgeTypes = { insert: InsertEdge }`. In `buildEditGraph`, set each edge `type: 'insert'`.

- [ ] **Step 2: Render the canvas on desktop in `PipelineBuilder`**

Replace the desktop `<div className="flow">…</div>` block (lines ~537–551) with:

```tsx
        <Suspense fallback={<div className="flow-canvas loading">Loading canvas…</div>}>
          <FlowCanvas
            graph={buildEditGraph({ steps, canEdit, prompts, labels, modelLabel })}
            callbacks={{
              busy: false,
              onEdit: openEdit, onToggleMode: toggleMode, onMove: move,
              onRemove: removeStep, onInsert: openNew,
              onViewPrompt: (id) => { const p = prompts.find((x) => x.id === id); if (p) setDetailPrompt(p); },
            }}
          />
        </Suspense>
```

Add the lazy import + `buildEditGraph` import at top (mirror Task 5). Keep the **mobile pager** `pager.isMobile` branch unchanged.

> `move(i, dir)` already exists (↑/↓ at lines 200–209); the StepCard's ←/→ buttons map to `onMove(i,-1)` / `onMove(i,1)`. No reorder-by-drag on canvas.

- [ ] **Step 3: Manual verification**

`pnpm dev`, open `/pipelines/new` and an existing pipeline on **desktop**: horizontal canvas, `+` on wires inserts a step (opens the drawer at the right index), card click edits, GATE/AUTO toggles, ←/→ reorder, ×/remove, eye opens prompt, drag repositions, Tidy re-snaps. Narrow → pager unchanged. Test ▶ still launches the run canvas.

- [ ] **Step 4: Checkpoint** — `type-check && test && build`. Do not commit.

---

## Phase C — Polish & harden

### Task 10: Final theming + node sizing

**Files:**
- Modify: `apps/web/src/layout/layout.css`

- [ ] **Step 1:** Ensure `.react-flow__node` width matches `NODE_W` (280) and that run nodes can grow taller when expanded (`height: auto`). Add a `.flow-rf-node` wrapper rule. Confirm the current/running node ring uses `var(--primary)` and that GATE/AUTO/badge styles render inside the canvas (they reuse `.flow-node` classes, so they should).
- [ ] **Step 2:** Verify focus rings and the orange accent stay scarce (only current wire/node + focus), per `apps/web/CLAUDE.md`.
- [ ] **Step 3: Checkpoint** — visual pass `pnpm dev`. Do not commit.

### Task 11: Full gate + bundle check

- [ ] **Step 1:** Run the full CI gate:

Run: `pnpm turbo run type-check lint test build`
Expected: all green.

- [ ] **Step 2:** Confirm React Flow is code-split:

Run: `pnpm --filter @lyra/web build`
Expected: a separate chunk containing `@xyflow/react` (lazy `FlowCanvas`), main bundle not ballooned. Note the gzip delta.

- [ ] **Step 3:** e2e unaffected (no api change):

Run: `pnpm --filter @lyra/api test:e2e`
Expected: green (sanity — nothing in `apps/api` changed).

- [ ] **Step 4: Stop. Report to the user.** Summarize what changed, the bundle delta, and that **commits are still held** awaiting their go-ahead.

---

## Self-review notes (author)

- **Spec coverage:** canvas look (Tasks 4–6, 8–10), pan/zoom/fit/Tidy (Task 5), bezier + animated current wire (Tasks 2,5), `+` inserter (Task 9), shared cards refactor (Tasks 3,7), lazy-load (Task 5), mobile pager untouched (Tasks 5,9), no backend change (whole plan is `apps/web`), tokens/orange-scarce (Tasks 6,10), tests on the pure mapping (Task 2), gate + bundle (Task 11). All spec §2/§4–§9/§11 items map to a task.
- **Placeholder scan:** the two "paste the existing markup" steps (Tasks 3,7) cite **exact source line ranges** + the exact callback substitutions — they are extraction instructions, not TBDs.
- **Type consistency:** `RunNodeData`/`EditNodeData` defined in Task 2 are consumed by `RunStepNode`/`StepNode` (Tasks 4,8); `FlowCallbacks` (Task 4) is consumed by every node + both wirings (Tasks 5,9); `buildEditGraph` gains `prompts/labels/modelLabel` in Task 8 and they're supplied in Task 9.
- **Ordering caveat:** `FlowCanvas` (Task 5) imports `StepNode` (Task 8). Create `StepNode.tsx` as a stub first or reorder Task 8 before Task 5 — noted in Task 5 Step 1.
