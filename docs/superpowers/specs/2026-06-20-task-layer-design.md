# Task layer — project → tasks → pipelines, with status + assignee

**Date:** 2026-06-20
**Status:** Design approved, pending spec review
**Scope:** Insert a Task work-unit between Project and Pipeline. Sibling spec:
the workspace personal/team model.

## Problem & goals

Today a **Project holds pipelines directly** (`project.pipelines[]`) and **runs
scope to (project, pipeline)** — the project page is the pipelines-hub + run
workbench. There is no project-management layer.

We want a **Task** as the unit of work inside a project:

- One project → **many tasks**; one task → **many pipelines**.
- A task has a **status** (`new · in_progress · on_hold · complete`, **manual**)
  and a **single optional assignee** (a team member).
- The project page becomes a **task board** (grouped by status); the **task
  detail** view is the run workbench, scoped to that task's pipelines.

This matches how PM tools (Asana/Linear/Trello) model work items, with Lyra's
twist that a task also bundles the AI pipelines that produce its output.

## Non-goals (future)

Due dates, multiple assignees, auto-status derived from runs, task
comments/activity feed, drag-to-reorder. All slot onto this model later.

---

## Data model (`@lyra/shared`)

- `enum TaskStatus { New = 'new', InProgress = 'in_progress', OnHold = 'on_hold', Complete = 'complete' }`.
- New `Task` transport interface:
  ```ts
  interface Task extends Audited {
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    description: string;
    status: TaskStatus;
    assignee?: UserRef;    // expanded; assigneeId carried in DTOs
    pipelines: string[];   // workspace-library pipeline ids
  }
  ```
- **`Project` loses `pipelines: string[]`** — it moves onto `Task`. The project
  becomes a container of tasks. (Migration below moves existing data.)
- **`Run` gains `taskId: string`** (indexed). It keeps `projectId` for
  project-level queries and `pipelineId`. Runs scope to **(taskId, pipelineId)**.
  Builder "test runs" (no project) also have no task — `taskId` is optional on the
  type, required for project/task runs.
- DTOs:
  ```ts
  interface CreateTaskDto { name: string; description?: string; pipelines?: string[]; }
  interface UpdateTaskDto {
    name?: string; description?: string; status?: TaskStatus;
    assigneeId?: string | null;   // null clears the assignee
    pipelines?: string[];
  }
  ```

## API surface

Task CRUD is nested under the project (so `ProjectAccessGuard` applies):

- `GET    /projects/:id/tasks` — list tasks (assignee expanded).
- `POST   /projects/:id/tasks` — create. `@RequireCreate`.
- `GET    /projects/:id/tasks/:taskId` — one task.
- `PATCH  /projects/:id/tasks/:taskId` — update name/description/status/
  assignee/pipelines. `@RequireCreate`. Validates `assigneeId` is a member of the
  workspace.
- `DELETE /projects/:id/tasks/:taskId` — soft-delete; **cascades** a soft-delete
  to the task's runs (they are scoped to the task). `@RequireCreate`.

Run endpoints re-root under the task:

- `POST /projects/:id/tasks/:taskId/pipelines/:pipelineId/runs` — run one pipeline.
- `POST /projects/:id/tasks/:taskId/runs/all` — run every pipeline on the task.
- `GET  /projects/:id/tasks/:taskId/runs` — run history for the task.
- Builder test-run endpoint (`/workspaces/:id/pipelines/:pipelineId/test-runs`)
  is unchanged.

## Access control

- All task + task-run routes sit under `/projects/:id`, guarded by the existing
  chain: `JwtAuthGuard → WorkspaceGuard → ProjectAccessGuard`. Project-viewers see
  tasks; editors manage them.
- Create / edit / assign / delete require create-rights (`@RequireCreate`, i.e.
  not Viewer). Assignment requires the assignee to be a workspace member.
- **Personal workspaces**: tasks work fully; the assignee picker is hidden and
  `assignee` stays empty.

## Web

- **Project detail (`apps/web/src/pages/ProjectDetail.tsx`) → task board.**
  Columns grouped by the four statuses; each `TaskCard` shows name · assignee
  avatar · pipeline count · status. "+ Add task" creates a task. On phones the
  board stacks into status sections (kanban columns don't fit mobile).
- **New task detail view** = today's pipelines-hub + run workbench moved down a
  level: reuses `RunFlow` / `FlowPager` / `useRunActions`, scoped to the task's
  pipelines, with a task header (status dropdown, assignee picker, description,
  the pipeline picker). Run from here, see per-(task,pipeline) history.
- Shared web helpers reused: `STATUS_COLOR`-style token map for the four task
  statuses (add to `apps/web/src/lib/constants.ts`), `avatarStyle`/`initial` for
  the assignee.

## Migration (migrate-mongo; nothing breaks)

For every existing project:

1. Create one **default Task** `{ projectId, workspaceId, name: 'General',
   status: 'new', pipelines: <project.pipelines>, createdBy: <project.createdBy> }`.
2. Set `taskId` on that project's existing runs to the new task's id.
3. Drop `pipelines` from the project document (code stops reading it).

After migration every project has exactly one task holding what it had before, so
all existing flows keep working.

## Testing strategy

- **shared** — `TaskStatus` enum consumed by the model; no new pure helper unless
  a status/transition guard emerges.
- **api** —
  - Task CRUD + access: viewer cannot create/edit; editor can; `assigneeId` must
    be a workspace member; delete cascades to runs. (mongodb-memory-server.)
  - Run-create is rejected when the pipeline isn't on the task; runs carry the
    right `taskId`.
  - Migration: default task adopts `project.pipelines`; runs get `taskId`;
    project loses `pipelines`.
- **web** — task board groups cards by status; task detail renders the workbench;
  assignee picker hidden in personal workspaces (renderToStaticMarkup, per the
  no-RTL convention).

## Open questions / defaults chosen

- **Task delete vs runs**: chose **cascade soft-delete** (a task's runs are its
  own history). Alternative — block delete while runs exist — rejected as more
  friction.
- **Default task name** on migration: `'General'`. (Could use the project name;
  "General" reads better as "the catch-all task".)
- **Pipeline count** shown on cards/board is derived from `task.pipelines.length`
  — not denormalized.
- Interaction with the workspace-track spec: tasks are workspace-scoped like
  everything else, so the personal/team and move-to-team changes need nothing
  special here — a moved project carries its tasks (and their pipelines/prompts)
  in the bundle.
