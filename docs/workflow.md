# Agent workflow — design/BA/QA ⇄ dev

Two agents collaborate through this repo. **They never talk directly: the task file
under `docs/specs/` is the message bus, and git is the transport.** Everything one
agent needs from the other lives in that file (plus the diff in git).

## Roles
- **Claude** — designer + business analyst + QA. Writes the spec & acceptance
  criteria; then tests each finished increment (Playwright against a real account +
  reading the diff) and writes the bug report.
- **Codex** — developer. Implements the spec on a branch, runs the gates, commits,
  and flips the task status. Reads the QA log and fixes bugs.
- **Human (orchestrator)** — runs each agent in turn. The docs carry state between
  runs, so neither agent has to be live at the same time.

## One file per task
Every task is a single markdown file: `docs/specs/YYYY-MM-DD-<slug>.md`, copied from
[`docs/specs/_TEMPLATE.md`](specs/_TEMPLATE.md). It holds **everything** — spec,
acceptance criteria, status, status log, and the QA log. Both agents read and update
the same file. No side channels (no chat-only context, no untracked notes).

## Status lifecycle (the handoff signal)
The `status:` field in the file's frontmatter is the flag.

```
draft → ready-for-dev → in-dev → ready-for-qa → (qa-failed ⇄ ready-for-qa) → done
                                                       ↑ blocked (any time)
```

| status | meaning | who sets it | who acts next |
|---|---|---|---|
| `draft` | spec being written | Claude | Claude |
| `ready-for-dev` | spec frozen, ACs final | Claude | **Codex** |
| `in-dev` | Codex implementing | Codex | Codex |
| `ready-for-qa` | implemented + committed | Codex | **Claude** |
| `qa-failed` | bugs found (see QA log) | Claude | **Codex** |
| `done` | all ACs pass + gates green | Claude | — |
| `blocked` | needs a decision | either | **Human** |

## The loop, step by step
1. **Claude** copies the template → writes Goal / Context & reuse / Requirements /
   **Acceptance Criteria** / Test plan → sets `status: ready-for-dev` → commits the spec.
2. **Codex** reads the file → branch `task/<slug>` → implements **only** what the ACs
   require → runs `pnpm turbo run lint type-check test` → commits → records the commit
   SHA in frontmatter and sets `status: ready-for-qa` → commits the file.
3. **How Claude knows to test:** when invoked, Claude scans `docs/specs/*` for
   `status: ready-for-qa` (or the human says "Codex pushed X"), reads `git log`/diff
   for the branch, then tests. The status field + git are the only signals needed —
   Claude never watches Codex work live.
4. **Claude tests** every AC (Playwright + manual review of the diff) and **appends a
   QA round** to the file: verdict, per-AC ✅/❌, and a bug list. Sets `status:
   qa-failed` (bugs) or `done` (clean).
5. **Codex fixes** exactly the bugs named in the QA log → recommits → `ready-for-qa`.
   Loop on the **same file** until `done`.

## Definition of Done
All of:
- Every acceptance criterion is ✅ in the latest QA round.
- `pnpm turbo run lint type-check test build` is green (what CI gates).
- No regression in the areas the task touched.
- Project invariants in [`/CLAUDE.md`](../CLAUDE.md) respected (shared has zero runtime
  deps; `passwordHash`/`encryptedKey`/`tokenHash` never leave the api; access control
  via the shared helpers; multi-tenancy scoped by `workspaceId`; etc.).

## Writing acceptance criteria (the most important rule)
Each AC must be **verifiable without judgment** — something Claude can click and
assert. Prefer Given / When / Then and name the concrete signal (route, DOM class,
breadcrumb text, API status/field). This is what makes the contract unambiguous for
an agent dev and turns QA from opinion into a checklist.

- ❌ Bad: "the page looks clean / works well."
- ✅ Good: "On `/projects/:id` (desktop ≥821px), `.eshell-head` is not rendered, and
  there is no `a[href^='/pipelines/']` deep link anywhere on the page."

## Bug report format (inside the QA log)
One bug should map to one failed AC where possible:

```
### Bug N · <severity: high|med|low> · <short title>   [AC#]
- Where: <file path / page / component>
- Repro: <exact steps, incl. login + route>
- Expected: <what the AC requires>
- Actual: <what happened>
- Evidence: <screenshot path or log snippet>
- Likely fix area: <file(s)>
```

## Conventions
- Branch per task: `task/<slug>`; small, focused commits.
- Run the gates before flipping to `ready-for-qa`; never `--no-verify` / skip hooks.
- The spec is the source of truth: if scope changes mid-task, **Claude edits the
  spec/ACs first**, bumps the status note, then Codex follows the new ACs.
- QA evidence (screenshots) can live outside the repo (e.g. a scratch e2e dir); the
  QA log just references the path.
