# Lyra UX redesign + Linear-enforcement plan — June 19, 2026

> Written overnight while you slept, per "continue your job, follow your
> recommendation." Goal you set: **redesign to follow the Linear system + make
> the app simple to use and easy to understand** (expert-designer lens), using
> `taste-skill` + `impeccable` and Figma validation. Those two are gated on you
> (install the plugins + connect Figma — see SESSION-HANDOFF), so tonight I did
> the part that needs neither: enforce the existing tokens and land the biggest
> UX win. This doc is the recon + what shipped + the roadmap for the rest.

## TL;DR — what shipped tonight (3 commits on `dev`, unpushed)

| Commit | What |
|---|---|
| `b47c782` | **Token consistency** — `--warning` + `--accent-*` tokens; run dots / flow borders / "done" badge read `--success`/`--warning` instead of raw hex; deduped the three `STATUS_COLOR` maps to tokens; Home tile accents tokenized (color-mix). **Fixes a real dark-mode bug**: draft/public badge text was too dark on dark surfaces. |
| `22473ad` | **Home "Get started" onboarding** (the headline) — dismissible checklist above the hub: keys → prompt → pipeline → project, with progress bar, done-checks, and a primary CTA on the first incomplete step. The order *is* the product's mental model, so it teaches as it guides. Pure logic unit-tested (5 tests). |
| `ed559e5` | **Settings "Get a key ↗" links** — each provider key row deep-links to that provider's API-key console when unset; completes onboarding step 1. |

Web gate green throughout (`type-check`, `lint`, **38 tests**, `build`). Nothing pushed.

## The two source-of-truth design docs (don't duplicate)

- **`docs/lyra-linear-audit.md`** — the Linear system measured from the Figma
  (geometry, type scale, elevation ramp, states), and how Lyra matched it. This
  is "the document." Lyra stays **light + orange `#FF6B1A`**, matching Linear's
  *structure/states/elevation*, not its dark/indigo.
- **`apps/web/src/styles/tokens.css`** + **`apps/web/src/index.css` `:root`** —
  the live tokens. NOTE there are two layers: `index.css :root` is what the app
  components actually read (with full `[data-theme=dark]` overrides);
  `styles/tokens.css` is a parallel Tailwind `@theme` layer used by utilities +
  the landing page. **A future cleanup: reconcile the two so there's one ladder.**
- `scripts/figma-mcp.sh <tool> '<json>'` re-pulls Linear specs from the Figma Dev
  Mode MCP over HTTP — this is the "validate against Figma" path you asked about.

## Recon findings (two audits: token-drift + expert UX heuristic)

### Visual: ~90% already token-based
The Linear token system is strong and largely enforced. Real drift was small and
is now mostly fixed (above). Remaining, lower-priority:
- **76 inline `style={{…}}`** across components; ~20 are `width:auto; marginTop:0`
  overrides fighting `.btn-primary`'s full-width + top-margin form defaults
  (worst: `ProjectDetail` 8, `PipelineBuilder` 6, `RunStepCard` 6). Fix: add a
  `.btn-primary.btn-inline { width:auto; margin-top:0 }` modifier and migrate.
- **Off-scale radii/spacing** (7px, 9px, 10px, 14px; 2/6/7/18px) — cosmetic.
- **Two token layers** (`index.css :root` vs `styles/tokens.css`) with divergent
  values (e.g. `--radius-sm` 6px vs 8px). Reconcile.
- **No shared `Modal`/`Button`/`EmptyState` primitives** — 10 modals each
  re-implement backdrop/escape; empty states share a CSS class but inline ~6 JSX
  lines × 3 pages. Extracting primitives is the design-system backbone (deferred —
  it's a refactor, not a user-visible win, so risky to do unattended).

### UX: the app is powerful but not self-explanatory
Biggest issues, ranked:
1. **No "what do I do next?"** on Home — **FIXED** tonight (Get-started checklist).
2. **Mental model is implicit** — Prompt ↔ Step ↔ Pipeline ↔ Project ↔ Run is
   never explained; users learn it only inside the builder. The checklist now
   teaches the spine; still want one-line helper text in the step drawer /
   PromptPicker ("a step runs a prompt from your library on a chosen model").
3. **Terminology overload** — "Chats" reads like team messaging (it's prompt
   testing); "Draft/Public" means different things on Prompts vs Projects.
   *Left alone tonight — renaming is a subjective product call for you.*
4. **Multi-purpose dense pages** — `ProjectDetail` (700 lines) shows metadata +
   pipelines hub + variables + run history at once; no clear primary action.
   Candidate for tabs / progressive disclosure (bigger refactor).
5. **Two run entry points** (builder vs project hub) feel disconnected; results
   land in different places.

## Roadmap — what's left, in priority order

**Needs you first (your chosen path):**
- Install `taste-skill` + `impeccable` (`/plugin …` — commands in SESSION-HANDOFF)
  and connect a Figma MCP (or hand me Linear refs). Then I run the full
  per-screen visual pass with those tools, validated against the Figma.

**Safe, non-blocked, can do next (ranked):**
1. Mental-model helper copy in the step drawer + PromptPicker (cheap, high clarity).
2. `.btn-inline` modifier + migrate the ~20 inline button overrides (DRY + consistency).
3. Reconcile the two token layers into one ladder.
4. Extract `Modal` + `EmptyState` (+ maybe `Button`) primitives; migrate incrementally.
5. `ProjectDetail` simplification (tabs / progressive disclosure) — biggest UX lift, biggest care.

**Your product decisions (I won't change unilaterally):**
- Rename "Chats" → "Playground"/"Test & Explore"?
- Disambiguate "Draft/Public" labels (Prompt vs Project mean different things).

## How to see tonight's work
The Vite dev server on `:5173` HMR'd these changes live, so **dev.getlyras.app
already shows the new Home onboarding** (log in as the tester). Toggle dark mode
(header) to see the badge-contrast fix.
