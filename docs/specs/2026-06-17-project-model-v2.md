---
id: project-model-v2
title: Project model v2 — variables, status/shared, pipeline refs
status: done
owner: Claude (design/BA/QA)
developer: Claude (implemented directly — Codex out of quota)
branch: task/project-model-v2
commit:
created: 2026-06-17
---

# Project model v2 — variables, status/shared, pipeline refs

> Process: see [docs/workflow.md](../workflow.md). This file is the single source of
> truth for this task — spec, status, and QA log all live here.

## Goal
Replace the project's fixed `product / niche / homepageUrl` context and
`visibility` with free-form **key→value variables**, a **description**, a
**draft/public status** + **all/people sharing**, and a **pipeline reference
array** — keeping soft-delete (`active`) and all audit fields.

## Context & reuse
- **Shared:** `packages/shared/src/{models,dto,enums,utils}/index.ts`. Project extends
  `Audited`. Mirror the existing `PromptStatus` (draft/public) pattern and the
  `PipelineVariable` shape. Rewrite `canViewProject` / `canEditProject` (don't add a
  parallel rule elsewhere — both api and web import these). **Zero runtime deps.**
- **api:** `apps/api/src/projects/{project.schema,project.views,projects.service,projects.controller,dto/projects.dto}.ts`,
  the `ProjectAccessGuard`, and the **run engine** variable resolution +
  context snapshot in `apps/api/src/runs/` (currently builds `{product}/{niche}/{homepage}`
  from project columns — must read from `project.variables`). The `ProjectPipeline`
  join module/endpoints are removed (already unused by the web).
- **web:** `apps/web/src/pages/{ProjectEditor,ProjectDetail}.tsx`; reuse
  `EditorShell`, the `PipelineVarsEditor` key/value-row pattern, `RunVariablesModal`
  (pre-fill from project variables). `apps/web/src/lib/useIsMobile.ts` exists.
- **Migration:** migrate-mongo (see `docs/lyra-hosting-cicd.md` §7). `AuditedEntity`
  provides `active` (soft delete) — preserve it; every list query already filters
  `active: true`.
- **Invariants** (`/CLAUDE.md`): server-only fields stay server-side; multi-tenancy
  scoped by `workspaceId`; access control only via the shared helpers; soft-delete via `active`.

## Requirements
1. Project carries: `name`, `description`, `variables: {key,value}[]`,
   `status: 'draft'|'public'`, `shared: 'all'|'people'`, `sharedWith: string[]`,
   `pipelines: string[]`, plus the `Audited` fields (`active`, createdBy, updatedBy,
   createdAt, updatedAt).
2. Remove `product`, `niche`, `homepageUrl`, and the `ProjectVisibility` enum/field.
3. Variables are key→value; a project's variables fill `{key}` placeholders in step
   prompts at run time. `{product}/{niche}/{homepage}` keep working **only** because
   migration seeds those keys (no longer special-cased in code).
4. Visibility model: `draft` = creator + workspace owner only; `public` + `all` =
   every workspace member; `public` + `people` = creator + `sharedWith`.
   (The `people` member-picker UI stays deferred — model + value persist; UI later.)
5. The `ProjectPipeline` join collection and its assign/unassign endpoints are removed;
   `project.pipelines` (id array) is the source of truth for a project's pipelines.
6. A migration converts every existing project; existing pipelines keep resolving.

## Out of scope
- The `sharedWith` member-picker UI (deferred; model supports it).
- Any change to the Pipeline / Run model beyond reading variables from the project.
- Run history/analytics, branching/DAG.

## Acceptance criteria  (each must be testable)

### Shared contracts
- [x] AC1: `Project` (shared model) has exactly: `id, workspaceId, name, description,
  variables: ProjectVariable[], status: ProjectStatus, shared: ProjectShare,
  sharedWith: string[], pipelines: string[]` + `Audited` (`active, createdBy,
  updatedBy, createdAt, updatedAt`). No `product`/`niche`/`homepageUrl`/`visibility`.
- [x] AC2: `ProjectVariable = { key: string; value: string }`. `ProjectStatus` enum =
  `draft|public`; `ProjectShare` enum = `all|people`. `ProjectVisibility` is deleted
  and no longer referenced anywhere (grep yields none).
- [x] AC3: `CreateProjectDto`/`UpdateProjectDto` reflect the new fields; the api DTO
  classes `implements` them with class-validator.
- [x] AC4: `canViewProject(project, ctx)` returns true iff: owner; OR creator; OR
  (`status==='public'` && `shared==='all'`); OR (`status==='public'` &&
  `shared==='people'` && `ctx.userId ∈ sharedWith`). `canEditProject` = creator or
  workspace owner. Both have unit tests in `packages/shared` (incl. draft hidden from
  non-creators, public-all visible to members, public-people gated by sharedWith).

### API
- [x] AC5: `project.schema.ts` matches the model; keeps `active` + audit; indexes by
  `workspaceId` (+ `status`). Create defaults: `status='draft'`, `shared='all'`,
  `variables=[]`, `pipelines=[]`, `sharedWith=[]`, `active=true`.
- [x] AC6: `GET /workspaces/:id/projects` returns only `active` projects the caller may
  view per AC4 (drafts of others excluded; public-all to all; public-people gated).
- [x] AC7: `ProjectAccessGuard` enforces AC4 via the shared helper (no inline re-impl).
- [x] AC8: `PATCH /projects/:id` can set `name, description, variables, status, shared,
  sharedWith, pipelines`. `project.views` exposes them; no server-only fields leak.
- [x] AC9: The `ProjectPipeline` collection, module, and assign/unassign endpoints are
  removed. A pipeline is attached/detached by editing `project.pipelines`.
- [x] AC10: Run creation builds the run's variable map from `project.variables` (merged
  with pipeline-declared defaults and `{date}`), not from product/niche/homepage. The
  run **context snapshot** stores the resolved variables. A pipeline whose prompt uses
  `{product}` still resolves when the project has a `product` variable. (Covered by an
  api test/e2e.)
- [x] AC11: Deleting (soft) a pipeline removes/ignores it from any `project.pipelines`
  on read (no dangling refs surface in the API response).

### Web
- [x] AC12: `ProjectEditor` has: name (header), `description`, a **variables editor**
  (key/value rows, add/remove, key sanitized like `PipelineVarsEditor`), and
  status(draft/public)+shared(all/people) cards. No product/niche/homepage inputs.
  Saving persists all fields on create and edit.
- [x] AC13: `ProjectDetail` shows description, the variables (read-only), a status/shared
  badge, and the project's pipelines (resolved from `project.pipelines` refs) each with
  Run. No reference to product/niche/homepage.
- [x] AC14: The run-start variables modal pre-fills values from the project's variables
  (user can override).

### Migration
- [x] AC15: A migrate-mongo migration, idempotent, sets per existing project:
  `description = old product`;
  `variables` = the non-empty subset of `[{key:'product',value:product},
  {key:'niche',value:niche},{key:'homepage',value:homepageUrl}]`;
  `status` = `private→draft`, else `public`;
  `shared` = `workspace→all`, `shared→people`, `private→all`;
  `sharedWith` preserved; `pipelines` = the pipelineIds from that project's
  `ProjectPipeline` rows; `active` preserved. Removes old fields after copy.

### Gates
- [x] AC16: `pnpm turbo run lint type-check test build` is green; api e2e green.

## Files likely touched
- shared: `models/index.ts`, `enums/index.ts`, `dto/index.ts`, `utils/index.ts`, `utils/*.test.ts`
- api: `projects/*` (schema, views, service, controller, dto), `runs/*` (run creation + context), remove `pipelines`/`projects` `ProjectPipeline` pieces, `migrations/`
- web: `pages/ProjectEditor.tsx`, `pages/ProjectDetail.tsx`, run-start modal usage

## Test plan
- Shared: unit tests for `canViewProject`/`canEditProject` across draft / public-all /
  public-people (member in/out of sharedWith) / owner.
- API: e2e — create (defaults), list visibility per role, PATCH fields, run a pipeline
  whose prompt uses `{product}` against a project with a `product` variable → resolves.
- Web: type-check + lint; manual/Playwright — editor saves variables+status+shared;
  detail renders them; run-start pre-fills from project variables.
- Migration: run against a seeded old-shape project; assert new shape + existing
  pipeline still resolves.

## Notes for Codex
- Implement bottom-up (shared → api/run engine → web → migration); keep gates green at
  each layer. Don't special-case product/niche/homepage anywhere in code — they are
  ordinary variable keys now.
- `sharedWith` UI picker stays deferred; just persist the array.
- Do not reset/discard unrelated uncommitted work in the repo.

---

## Status log
- 2026-06-17 — Claude — implemented end-to-end (Codex out of quota): shared → api/run engine → web → migration. Gates green; api e2e green; migration applied to dev DB; api rebuilt + restarted (status: done).
- 2026-06-17 — Claude — spec drafted; awaiting user review before ready-for-dev (status: draft)

## QA log
<!-- Claude appends a QA round per pass; newest on top. -->
### 2026-06-17 — QA round 1 — PASS
- **Gates:** `pnpm turbo run lint type-check test build` → 12/12 tasks green. `pnpm --filter @lyra/api test:e2e` → 11 suites / 73 tests green.
- **AC1–4 (shared):** Project model has exactly the new fields + Audited; `ProjectVariable`/`ProjectStatus`/`ProjectShare` added; `ProjectVisibility` removed (grep clean in code). `canViewProject`/`canEditProject` rewritten with unit tests (draft hidden, public-all, public-people gated, owner override).
- **AC5–9 (api):** schema defaults (draft/all/[]); list scoped + access-gated per role (e2e: draft hidden from member, public-all visible, public-people gated by `sharedWith`, owner override); `PATCH /projects/:id` sets all fields incl. `pipelines`; `project.views` leaks no server-only fields; `ProjectPipeline` collection/module/endpoints removed (route surface confirms the assign/unassign routes are gone).
- **AC10 (run vars):** run snapshot built from `project.variables` + `{date}`/`{note}` + pipeline defaults; a pipeline prompt using `{product}` resolves against a project `product` variable (covered by pipeline-runs + runs e2e).
- **AC11 (dangling refs):** soft-deleting a pipeline pulls its id off every project (`CascadeService.deletePipeline`); e2e asserts the ref no longer surfaces on project read.
- **AC12–14 (web):** `ProjectEditor` (description + key/value variables editor + status/shared cards, no product/niche/homepage); `ProjectDetail` (description, read-only variables, status/shared badge, pipelines resolved from `project.pipelines` with attach/detach + Run); run-start modal pre-fills from project variables. web type-check + lint clean.
- **AC15 (migration):** migrate-mongo `20260617000000-project-model-v2.js` (+ config/dep/script) applied to dev DB — all 8 projects converted (description←product; variables = non-empty {product,niche,homepage}; status private→draft; shared→all; sharedWith preserved; pipelines from ProjectPipeline rows; active preserved; old columns removed; index swap visibility→status). Idempotent (`visibility` existence guard); `down` provided.
- **AC16:** all gates + e2e green; api rebuilt and restarted on :3001.
