# Task Layer Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans / inline TDD. Steps use `- [ ]` checkboxes.

**Goal:** Insert a `Task` work-unit between Project and Pipeline — Project becomes a board of Tasks; pipelines + runs live under Tasks; Tasks carry a manual status + a single assignee.

**Architecture:** New `Task` collection (workspace-scoped, under a project). `project.pipelines[]` moves to `task.pipelines[]`; `Run` gains `taskId`; run endpoints re-root under `/projects/:id/tasks/:taskId/...`. A migrate-mongo migration gives every existing project one default "General" task adopting its pipelines + repointing its runs. Web: project detail → task board; a new task detail view is the existing run workbench scoped to the task.

**Tech Stack:** NestJS 10 + Mongoose (api), React 18 + Vite + react-router + react-i18next (web), `@lyra/shared`, migrate-mongo, Jest + mongodb-memory-server, Vitest + renderToStaticMarkup.

## Global Constraints

- Enums/DTO interfaces in `@lyra/shared` (zero runtime deps); api DTOs `implements` them. Rebuild shared (`pnpm --filter @lyra/shared build`) before api/web type-check.
- Access control: task + task-run routes are under `/projects/:id` → existing `JwtAuthGuard → WorkspaceGuard → ProjectAccessGuard` chain; create/edit/assign/delete require `@RequireCreate` (not Viewer). `assigneeId` must be a workspace member.
- TaskStatus values exactly: `new` · `in_progress` · `on_hold` · `complete`. Status is **manual** (no run coupling).
- Single assignee (`assigneeId?`); personal workspaces have no assignee (UI hides the picker).
- i18n en+vi for every string. Token-only CSS. Web tests via `renderToStaticMarkup` (no RTL).
- Git: stage explicit files only; local commits only (no push) until the user asks. Keep `pnpm turbo run lint type-check test build` green; run `test:e2e` after the migration/run-rooting tasks.
- Migration must be reversible (`up`/`down`) and idempotent-safe to re-run on dev.

## File Structure

**shared:** `enums/index.ts` (+`TaskStatus`), `models/index.ts` (+`Task`; `Run.taskId?`; later remove `Project.pipelines`), `dto/index.ts` (+`CreateTaskDto`/`UpdateTaskDto`).
**api:** `tasks/{task.schema.ts, tasks.service.ts, tasks.controller.ts, tasks.module.ts, dto/tasks.dto.ts, task.views.ts}`; `runs/runs.controller.ts` (re-root); `runs/run.schema.ts` (+taskId); `migrations/2026062014-task-layer.js`; `projects/*` (drop pipelines in cutover); `app.module.ts` (register TasksModule).
**web:** `pages/ProjectDetail.tsx` → board; new `pages/TaskDetail.tsx` + `components/{TaskBoard,TaskCard}.tsx`; `lib/taskStatus.ts` (status token map + labels); router; `i18n/locales/{en,vi}/{tasks,projects}.ts`.

---

### Task 1: Shared contracts (TaskStatus + Task + DTOs + Run.taskId)

**Files:** Modify `packages/shared/src/{enums,models,dto}/index.ts`.

- [ ] Add enum:
```ts
export enum TaskStatus { New='new', InProgress='in_progress', OnHold='on_hold', Complete='complete' }
```
- [ ] Add model (import `TaskStatus`):
```ts
export interface Task extends Audited {
  id: string; workspaceId: string; projectId: string;
  name: string; description: string;
  status: TaskStatus; assignee?: UserRef; pipelines: string[];
}
```
Add `taskId?: string;` to `Run`. Leave `Project.pipelines` in place for now (removed in Task 8).
- [ ] Add DTOs:
```ts
export interface CreateTaskDto { name: string; description?: string; pipelines?: string[]; }
export interface UpdateTaskDto { name?: string; description?: string; status?: TaskStatus; assigneeId?: string | null; pipelines?: string[]; }
```
- [ ] `pnpm --filter @lyra/shared build && pnpm --filter @lyra/shared type-check` → PASS. Commit `feat(shared): Task model + TaskStatus + Run.taskId`.

---

### Task 2: api — Task schema + service + controller (CRUD, TDD)

**Files:** Create `apps/api/src/tasks/{task.schema.ts, task.views.ts, tasks.service.ts, tasks.controller.ts, tasks.module.ts, dto/tasks.dto.ts}`; modify `app.module.ts`. Test `tasks.service.spec.ts`.

Mirror the `labels`/`requests` modules for structure. Schema (extends `AuditedEntity`): `workspaceId` (index), `projectId` (index), `name`, `description` (default ''), `status` (enum `Object.values(TaskStatus)`, default `new`, index), `assigneeId?` (string), `pipelines: string[]` (default []). Index `{ projectId, createdAt: -1 }`.

`task.views.ts`: `toTaskView(doc, refs)` → resolves `createdBy`/`updatedBy`/`assigneeId` to `UserRef` (reuse `userRef` + `UsersService.refMap`); `assignee` omitted when no `assigneeId`.

Service: `list(projectId)`, `create(projectId, workspaceId, actorId, dto)`, `get(id)`, `update(id, actorId, dto)` (validate `assigneeId` membership via `MembershipsService.findFor`; reject non-member), `remove(id, actorId)` (soft-delete + cascade soft-delete its runs — inject a runs accessor or do it in the controller via RunsService).

Controller `@Controller()` `@UseGuards(WorkspaceGuard, ProjectAccessGuard)`:
`GET projects/:id/tasks`, `POST projects/:id/tasks` `@RequireCreate`, `GET projects/:id/tasks/:taskId`, `PATCH projects/:id/tasks/:taskId` `@RequireCreate`, `DELETE projects/:id/tasks/:taskId` `@RequireCreate` (204).

- [ ] TDD: spec asserts create defaults status=new; update sets status/assignee; assign rejects a non-member; delete soft-deletes. Then implement. `pnpm --filter @lyra/api test -- tasks.service` → PASS; api type-check. Commit `feat(api): Task CRUD under a project`.

> **⚠️ Pre-req check before coding:** confirm `ProjectAccessGuard`'s exact import path + how it reads `:id`, and how `@RequireCreate` is applied in `labels.controller.ts`. Match those exactly.

---

### Task 3: api — Run gains taskId; run endpoints re-rooted under task

**Files:** Modify `apps/api/src/runs/run.schema.ts` (+`taskId?` index), `runs/runs.controller.ts`, `runs/runs.service.ts`. Tests in `runs.service.spec.ts`.

- [ ] Add `taskId?: string` (indexed) to the Run schema.
- [ ] Re-root creation + history under the task (the pipeline must belong to `task.pipelines`):
  - `POST projects/:id/tasks/:taskId/pipelines/:pipelineId/runs`
  - `POST projects/:id/tasks/:taskId/runs/all` (iterate `task.pipelines`)
  - `GET projects/:id/tasks/:taskId/runs`
  Each sets `taskId` on the run; keeps `projectId`/`workspaceId`. Inject `TasksService` to read the task. Remove the old `projects/:id/pipelines/:pipelineId/runs`, `projects/:id/runs/all`, `projects/:id/runs` (replaced). Keep `workspaces/:id/pipelines/:pipelineId/test-runs` and all `runs/:id/...` step/asset routes unchanged.
- [ ] TDD: run-create rejects a pipeline not on the task; run carries the right `taskId`. Implement. `pnpm --filter @lyra/api test -- runs` + type-check. Commit `feat(api): scope runs to (task, pipeline)`.

---

### Task 4: api — migration (default task per project + repoint runs)

**Files:** Create `apps/api/migrations/2026062014-task-layer.js` (follow `20260617000000-project-model-v2.js`).

- [ ] `up(db)`: for each `projects` doc, insert a `tasks` doc `{ workspaceId, projectId: <_id>, name: 'General', description: '', status: 'new', pipelines: <project.pipelines ?? []>, active: true, createdBy: project.createdBy, updatedBy: project.updatedBy, createdAt: now, updatedAt: now }`; then `updateMany({ projectId: <_id> }, { $set: { taskId: <taskId> } })` on `runs`; finally `$unset` `pipelines` from the project. Create indexes on `tasks` (`{ projectId, createdAt: -1 }`, `{ workspaceId }`, `{ status }`).
- [ ] `down(db)`: copy each default task's `pipelines` back to its project, `$unset taskId` on runs, drop the `tasks` collection.
- [ ] Run it on dev: `pnpm --filter @lyra/api exec migrate-mongo up`. Verify a project now has a General task with its pipelines and its runs carry `taskId`. Commit `chore(api): migrate projects to a default task`.

> Note: this migration is also where existing data cutover happens; run it **before** removing `Project.pipelines` from code (Task 8) so nothing reads a dropped field mid-deploy.

---

### Task 5: web — project detail becomes a task board

**Files:** Modify `apps/web/src/pages/ProjectDetail.tsx`; create `components/{TaskBoard,TaskCard}.tsx`, `lib/taskStatus.ts`; `i18n/locales/{en,vi}/tasks.ts`; CSS.

- [ ] `lib/taskStatus.ts`: `TASK_STATUS_ORDER: TaskStatus[]`, `TASK_STATUS_COLOR` (token map), label keys.
- [ ] `TaskBoard`: fetch `GET /projects/:id/tasks`; render columns grouped by status (desktop) / stacked sections (mobile); each `TaskCard` shows name · assignee avatar (`avatarStyle`/`initial`) · pipeline count (`task.pipelines.length`) · status. "+ Add task" (name → `POST`). Clicking a card routes to the task detail.
- [ ] Replace ProjectDetail's pipelines-hub + run sections with the board (keep the project header/context). 
- [ ] TDD (renderToStaticMarkup): board groups cards by status. Type-check + lint + test. Commit `feat(web): project page is a task board`.

---

### Task 6: web — task detail = run workbench scoped to the task

**Files:** Create `apps/web/src/pages/TaskDetail.tsx`; add route `/projects/:id/tasks/:taskId`; reuse `RunFlow`/`FlowPager`/`useRunActions`; modify run API calls to the task-scoped endpoints; `i18n`.

- [ ] Task header: name, description, **status dropdown** (`PATCH` status), **assignee picker** (members from `GET /workspaces/:id/members`; hidden when `current.type === Personal`), the pipeline picker (`PromptPicker`-style, edits `task.pipelines`).
- [ ] The run workbench: lift the existing ProjectDetail run logic (RunFlow + recent runs) into TaskDetail, calling the task-scoped run endpoints from Task 3.
- [ ] TDD: task detail renders the workbench; assignee picker hidden in personal. Type-check + lint + test. Commit `feat(web): task detail run workbench`.

---

### Task 7: web/api — wire navigation + run plumbing (`useRunActions`)

**Files:** `apps/web/src/lib/useRunActions.ts` (point run-create/run-all/history at task endpoints), router, breadcrumbs.

- [ ] Update `useRunActions` to take `taskId` and hit `/projects/:id/tasks/:taskId/...`. Update any caller (the builder's project picker → now needs a task too: pick project → task → Run).
- [ ] Breadcrumb: Project › Task. Type-check + lint + test. Commit `feat(web): route runs through tasks`.

---

### Task 8: Cutover cleanup — remove Project.pipelines

**Files:** `packages/shared/src/{models,dto}/index.ts` (drop `Project.pipelines`, `CreateProjectDto.pipelines`, `UpdateProjectDto.pipelines`), `apps/api/src/projects/*` (schema + service + dto), web (any remaining `project.pipelines` reads).

- [ ] Remove `pipelines` from the Project model/DTO/schema/service. Grep `project.pipelines` / `.pipelines` across api + web; repoint or delete. (The migration already moved the data.)
- [ ] Full gate + e2e: `pnpm turbo run lint type-check test build && pnpm --filter @lyra/api test:e2e`. Fix any fallout (e2e specs that created project pipelines now create a task first). Commit `refactor: remove Project.pipelines (moved to Task)`.

---

### Task 9: Full gate + smoke

- [ ] `pnpm turbo run lint type-check test build` green; `test:e2e` green (modulo the known pre-existing fan-out failures).
- [ ] Manual smoke (dev): project page shows the board; add a task; open it; attach a pipeline; run it; status dropdown + assignee (team) work; personal hides assignee.

## Self-review note
The cutover ordering matters: Tasks 1–7 are additive (Project.pipelines still exists, migration creates tasks), Task 8 removes the old field only after data + UI moved. The migration (Task 4) must run on any environment before the Task 8 code deploys.
