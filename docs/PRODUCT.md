# Lyra — Product brief (design context)

> Context pack for mocking up Lyra screens in Claude Design. Pair this with
> `DATA-MODEL.md` (entities + fields) and the **Lyra Design System** components.
> Distilled from `docs/lyra-requirements.md`, `docs/lyra-pipelines.md`, and the
> typed contracts in `packages/shared`. Source of truth is the code.

## What Lyra is

A multi-user web app where teams run **AI creative pipelines** for a brand or
product — turning a product page into on-brand images and UGC/video. Users
compose reusable pipelines from a library of prompts, assign them to work items
in a project, and run them. Runs are a state machine: some steps pause at
**gates** for human approval before continuing.

The audience is small marketing/creative teams and solo operators (dropshipping,
DTC brands). Bring-your-own AI keys; **no billing or metering in v1**.

## The brand / look

Light UI, **Linear-style** geometry and component language, with Lyra's **orange
`#FF6B1A`** as the single brand accent (used only for primary CTAs, focus, and
active state). Dense controls (32px height, 4–6px radii), Inter type, thin
hairlines, subtle flat shadows. There is a dark mode (same tokens, inverted).
Not indigo, not glassy, not pill-heavy.

## Core concepts

- **Workspace** — the tenant. Owns everything (projects, prompts, pipelines,
  keys, runs). Two kinds: **personal** (auto-created on sign-up) and **team**
  (admin-approved upgrade). Members have a **role**: Owner / Member / Viewer.
- **Prompt (library)** — a reusable, parameterized prompt with `{variables}`,
  a type (text/image/audio/video), draft/public status, tags, and a default
  provider·model. Owns **saved results** (good answers gathered from chats).
- **Pipeline** — an ordered, **linear** chain of **Steps**. Each step binds one
  library Prompt to a chosen **provider·model** and a **mode** (auto, or **gate**
  = pause for approval). Steps chain via `{input}` / `{step:Name}`; can **fan
  out** over a collection and have a **skip condition**.
- **Project** — a board of **Tasks** for one brand/product. Carries **variables**
  (e.g. `product`, `niche`, `homepage`) that fill `{key}` placeholders at run
  time. Visibility: draft → public (reach: all members, or chosen people).
- **Task** — a card on the project board (Linear-style status + priority +
  assignee + tags). Holds the **pipelines** that produce its output.
- **Run** — one execution of a pipeline against a task. A state machine
  (`idle → running → awaiting_gate → done/error`) with per-step status, results,
  assets, and a 👍/👎 rating. Variables/collections are frozen at run start.
- **Chat** — a Claude-style multi-turn conversation: the iteration workshop for
  prompts. Good prompts are promoted to the library via **Save as prompt**.
- **Marketplace** — a global, read-only catalog of community prompts a user can
  browse and **adopt** into their workspace library.

## The core flow

1. **Find a prompt** — browse the **Marketplace** or workspace **Prompts** library;
   adopt/author one. Iterate wording in **Chats**, then *Save as prompt*.
2. **Compose a Pipeline** — in the vertical-flow **builder**, add steps; each step
   picks a public Prompt + provider·model + auto/gate.
3. **Set up a Project** — name it, fill context variables (`product`, `niche`,
   `homepageUrl`), set visibility. Add **Tasks** (the board).
4. **Assign + Run** — assign pipeline(s) to a task and run. The engine fills
   `{variables}`, chains step outputs, and **pauses at gates** for **Approve**.
   Watch live per-step status in the unified **run view** (`RunFlow`).
5. **Review** — expand step results, approve gates, rate the run. Render steps
   produce **assets** (image/video).

## Key screens (to mock up)

- **Home** — hub of section tiles + a get-started checklist.
- **Marketplace** — card gallery (search · AI rank · filter); adopt to library.
- **Prompts** — library card gallery; **Prompt detail** (read view + saved results);
  **Prompt editor**.
- **Pipelines** — library; **builder** (vertical step flow + step drawer with a
  Prompt picker) — the single create+edit surface.
- **Projects** — project gallery; **Project detail** = task board + run workbench;
  **Project editor**; **Task detail** + **Task editor**.
- **Run view** — the vertical flow lit up live: per-step status, inline gate
  Approve, expandable results. Mobile = one-step pager.
- **Chats** — a bottom-right **AI FAB** opens a multi-turn assistant; *Save as prompt*.
- **Settings** — workspace, encrypted per-provider **API keys** (BYO).
- **Members** — roster, invites, role management; a notification bell for invites.
- **Admin** (super-admin only) — users, usage, requests.

## Constraints that shape UI

- **Per-step key gating**: a step is runnable only if the workspace has an API key
  for that step's provider. Show clearly when a key is missing.
- **Email-unverified users** can browse Home + Marketplace but cannot create/run.
- **Gates** are the human-in-the-loop moment — the run view's most important state.
- **Variables** (`{product}`, `{niche}`, `{step:Name}`, `{input}`) are surfaced as
  chips in prompt/step UIs.
