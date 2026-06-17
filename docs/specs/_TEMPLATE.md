---
id: <slug>                       # kebab-case, matches the filename
title: <Human title>
status: draft                    # draft | ready-for-dev | in-dev | ready-for-qa | qa-failed | done | blocked
owner: Claude (design/BA/QA)
developer: Codex
branch: task/<slug>
commit:                          # SHA Codex sets when flipping to ready-for-qa
created: YYYY-MM-DD
---

# <Human title>

> Process: see [docs/workflow.md](../workflow.md). This file is the single source of
> truth for this task — spec, status, and QA log all live here.

## Goal
<One sentence: what this delivers and why.>

## Context & reuse
<Point Codex at what already exists so it builds on patterns instead of inventing them.>
- Relevant files: `apps/web/src/...`, `apps/api/src/...`
- Reuse these components/helpers: <e.g. `EditorShell`, `.row`/`.list`, `RunFlow`, `fillPrompt`>
- Constraints / invariants that apply: <e.g. shared has zero runtime deps; server-only fields stay in the api>

## Requirements
1. <imperative requirement>
2. ...

## Out of scope
- <things NOT to build, so Codex doesn't gold-plate>

## UX / design
<Layout, states (empty/loading/error), which existing styles to match. Reference
screenshots or other pages by route.>

## Acceptance criteria  ← the contract (each MUST be testable, no judgment)
- [ ] AC1: Given <state> When <action> Then <observable result + concrete signal>
- [ ] AC2: ...
- [ ] AC3: ...

## Files likely touched
- Create: `...`
- Modify: `...`

## Test plan (how QA will verify each AC)
- AC1 → <Playwright/manual: route, selector, assertion>
- AC2 → ...
- Gates: `pnpm turbo run lint type-check test build` must pass.

## Notes for Codex
- <gotchas, naming, edge cases, anything that would otherwise cause a wrong guess>

---

## Status log
<!-- one line per transition: date — who — note (status: X) -->
- <YYYY-MM-DD> — Claude — spec drafted (status: draft)

## QA log
<!-- Claude appends one round per QA pass. Newest at the top. Template:

### QA — Round 1  (commit <sha>, <date>)
Verdict: PASS | FAIL (<n> bugs)
AC1 ✅  AC2 ✅  AC3 ❌ (bug 1)

#### Bug 1 · high · <title>   [AC3]
- Where: <file/page>
- Repro: <steps>
- Expected: <per AC3>
- Actual: <what happened>
- Evidence: <screenshot path>
- Likely fix area: <file>
-->
