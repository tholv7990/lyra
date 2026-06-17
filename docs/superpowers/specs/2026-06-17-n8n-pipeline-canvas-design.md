# Spec — n8n-style pipeline canvas (front-end only)

**Date:** 2026-06-17
**Branch:** dev
**Status:** approved design, pre-implementation
**Scope owner surface:** `apps/web` only — **no backend / no data-model change**

## 1. Goal

Make Lyra's pipeline builder and run view *look and feel like n8n's workflow canvas*
(reference: the node-flow on n8n's homepage / editor): a horizontal, draggable canvas
with node cards joined by curved bezier wires, a dotted-grid background, and pan/zoom.

This is the **"n8n look, one path"** option: a visual/interaction restyle of the
**existing linear chain**, not a branching DAG. The pipeline remains a single ordered
sequence; we are not adding branches, parallel paths, conditionals, or edges to the data
model.

## 2. Scope

**In scope (apps/web):**
- A new shared `FlowCanvas` (React Flow / `@xyflow/react`) rendered on **desktop** by both
  the **run view** (`RunFlow`) and the **builder** (`PipelineBuilder`).
- Horizontal `Start → step₁ → … → stepₙ → End` layout, dotted grid, pan/zoom/fit, a Tidy
  (auto-layout) control, draggable node repositioning, bezier wires.
- An **animated wire on the currently-running step** in run mode (doubles as the run
  "light-up" animation).
- Custom React Flow node types wrapping the **existing** card markup (no card rewrite).
- A small in-scope refactor: extract the builder's inline `renderNode` and the run view's
  `RunNode` into shared card components reused by both the canvas and the mobile pager.

**Explicitly out of scope:**
- Any change to `@lyra/shared` models, the API, the run engine, or persisted data.
- Branching / parallel / conditional topology (that was the rejected "Real branching" option).
- Persisting node positions (positions are ephemeral — see §6).
- Mobile canvas — mobile keeps the existing `FlowPager` untouched.
- A minimap (YAGNI for a short linear chain).

## 3. Invariants preserved

- `Pipeline.steps: PipelineStep[]` and `Run.steps: Step[]` stay **linear arrays**; order is
  the single source of truth. Edges are *derived* from array order, never user-drawn.
- All run plumbing (`useRunActions`, gates/approve, per-step key gating, `{input}`/`{step}`
  chaining) is unchanged — the canvas only changes how steps are *rendered/positioned*.
- Light/Linear theme + scarce orange `#FF6B1A` accent (`apps/web/CLAUDE.md`): orange used
  only for the current/running node ring and its animated wire.

## 4. Architecture

```
PipelineBuilder.tsx (desktop)  ┐
                               ├─▶ <FlowCanvas mode="edit"|"run" … />  ── React Flow
RunFlow.tsx        (desktop)  ┘         │
                                        ├─ <Background variant="dots">
                                        ├─ <Controls> + Tidy button
                                        ├─ edges (bezier; animated on current step)
                                        └─ nodeTypes: { cap, step, runStep }
PipelineBuilder.tsx (mobile)  ┐
                               ├─▶ existing FlowPager  (UNCHANGED) ── shares the cards below
RunFlow.tsx        (mobile)  ┘
```

**New components** (`apps/web/src/components/`):
- `FlowCanvas.tsx` — the React Flow wrapper. Props: `mode: 'edit' | 'run'`, the data
  (`steps`/`run`), and the same callbacks each surface already owns
  (`openNew/openEdit/toggleMode/move/removeStep` for edit; `onRunStep/onApprove/onSavePrompt`
  + `hasKey`/`busy` for run). It builds `nodes`+`edges` from the array, registers the custom
  node types, and renders Background/Controls/Tidy. **No business logic** — it delegates.
- `flow/CapNode.tsx` — the ● Start / ◉ End caps as small rounded nodes (source/target handle
  only).
- `flow/StepNode.tsx` — edit-mode node: a `<Handle target left>` + `StepCard` + `<Handle
  source right>`.
- `flow/RunStepNode.tsx` — run-mode node: handles around `RunStepCard`.

**Refactor (de-dupe, in-scope):**
- `StepCard.tsx` — extracted from `PipelineBuilder.renderNode` (name, prompt snippet,
  provider·model, tags, GATE/AUTO toggle, eye, ←/→/× controls). Takes data + callbacks as
  props (no closure over builder state). Reused by `StepNode` **and** the mobile builder pager.
- `RunStepCard.tsx` — the current `RunNode` body promoted to its own file (status dot, head,
  inline Run/Approve, expandable input/prompt/result). Reused by `RunStepNode` **and** the
  mobile run pager.

**Lazy-load:** `FlowCanvas` is imported via `React.lazy` (with a lightweight fallback) so
React Flow (~50 KB gz) loads only on pipeline pages, not app-wide. Addresses the handoff's
bundle note (~585 KB / ~178 KB gz today).

## 5. Layout & wiring (linear → graph)

- Nodes: index `i` → position `{ x: i * (NODE_W + GAP), y: 0 }` (caps at the ends). Pure
  function of array order; recomputed on load and on Tidy.
- Edges: for the ordered list `[Start, s₀, s₁, …, sₙ₋₁, End]`, one bezier edge between each
  consecutive pair. Default (bezier) edge type. In run mode, the edge **into** the current
  step gets `animated: true`.
- Handles: each step has a target handle (left) + source handle (right), both
  `isConnectable={false}` (topology is locked — no user rewiring).
- Variable node height (run nodes expand to show results) is fine: handles move with the
  node and edges follow automatically.

## 6. Interaction model

- **Pan / zoom / fit:** React Flow `<Controls>` (built-in).
- **Tidy:** custom control button → re-runs §5 auto-layout, snapping nodes back to the
  canonical left→right order.
- **Drag a node:** repositions it freely on the canvas (the n8n feel). Positions are
  **ephemeral** — not persisted, recomputed from order on reload — so there is **no
  data-model change**. Dragging does **not** reorder the sequence.
- **Reorder the sequence:** unchanged controls — the per-node ← / → (today's ↑/↓ relabeled
  for horizontal) and the mid-wire **`+`** inserter. Drag-to-reorder is replaced by these to
  avoid ambiguity with free positioning.
- **Edit a step:** click the card → existing drawer + `PromptPicker` (unchanged).
- **Run a step / approve a gate:** inline Run / Approve buttons on the run card (unchanged).
- **Mobile:** `FlowPager` one-step pager, exactly as today (no canvas).

## 7. Styling

Override React Flow's default node/edge/handle/controls CSS to match Lyra's light/Linear
tokens — reuse the existing `.flow-node` visual language (white cards, soft radii, subtle
borders) inside React Flow nodes. Orange `#FF6B1A` is reserved for the current/running node
ring + its animated wire and focus states. Import `@xyflow/react/dist/style.css` once, then
layer Lyra overrides in the existing flow CSS.

## 8. Build phases (each independently shippable)

1. **Run view first (lower risk, most-seen).** Add `@xyflow/react`; build `FlowCanvas` +
   `CapNode` + `RunStepNode`; extract `RunStepCard`; swap `RunFlow`'s **desktop** branch to
   `<FlowCanvas mode="run">`. Animated current-step wire. Mobile pager untouched.
2. **Builder.** Extract `StepCard`; build `StepNode`; swap `PipelineBuilder`'s **desktop**
   branch to `<FlowCanvas mode="edit">`. `+` on edges, ←/→ reorder, mode toggle, drawer — all
   reusing existing handlers.
3. **Polish & harden.** Tidy/auto-layout, theming pass to tokens, lazy-load, tests, bundle
   check (`pnpm build` — confirm React Flow is split out of the main chunk).

## 9. Testing

- Vitest + React Testing Library:
  - `FlowCanvas mode="edit"` with N steps → N+2 nodes (Start/End) and N+1 edges rendered.
  - `FlowCanvas mode="run"` with a current step → that node has the `current` class and its
    incoming edge is `animated`.
  - Reorder/insert callbacks fire with the right indices (delegation intact).
- jsdom shims for React Flow per its testing guide: mock `ResizeObserver` (and the
  documented `DOMMatrixReadOnly` / `getBoundingClientRect` shims) in the Vitest setup; give
  the canvas wrapper a fixed size in tests.
- Full gate before "done": `pnpm turbo run type-check lint test build` green; `apps/api`
  e2e unaffected (no api change).

## 10. Risks & mitigations

- **React Flow needs an explicit container height.** Ensure the canvas wrapper inside
  `EditorShell` gets a real height (flex `min-height`, e.g. `70vh`), or the canvas collapses.
- **jsdom rendering.** Handled by the §9 shims; keep canvas tests behavioral (nodes/edges
  present), not pixel-level.
- **Bundle growth.** Mitigated by lazy-loading `FlowCanvas`; verify in phase 3.
- **React 19 compatibility.** `@xyflow/react` v12 supports React 19 (this repo is on
  `react@19`) — pin a v12 release.

## 11. Definition of done

- Desktop builder **and** run view render the n8n-style canvas; mobile unchanged.
- No diff under `apps/api`, `packages/shared`, or any persisted schema.
- Linear semantics intact (order, gates, chaining, key gating).
- Theme tokens honored; orange stays scarce.
- CI gate green; React Flow code-split out of the main chunk.
