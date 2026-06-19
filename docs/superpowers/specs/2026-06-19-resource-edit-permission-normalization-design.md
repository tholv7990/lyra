# Resource edit/delete permission — normalize + harden (v1 design)

- **Date:** 2026-06-19
- **Status:** Approved, not yet implemented. Branch `dev`.
- **Scope:** `@lyra/shared` (access helpers), `apps/api` (prompt + pipeline guards), `apps/web` (Prompts/Pipelines edit gating). No new roles.

## 1. Problem & intent

"Frontend hides the button, backend safeguards the action" is the permission model the
owner wants for shared resources. That pattern **already exists** for prompts, pipelines, and
projects — but the three are **inconsistent**, and two of them hand-roll the rule instead of
using the shared helper (violating invariant 4: access rules come from shared helpers).

The standard rule across the app is: **edit/delete a resource = its creator OR the workspace
Owner.** Only prompts are missing the Owner half.

## 2. Current state (audit)

| Resource | Backend safeguard | Frontend hides button | Workspace-Owner override? | Uses shared helper? |
|---|---|---|---|---|
| **Prompt** | `PromptAccessGuard` + `@RequirePromptOwner` | `canEdit = createdBy === me` | ❌ creator only | ❌ inline |
| **Pipeline** | `PipelineAccessGuard` + `@RequirePipelineOwner` | `createdBy === me \|\| role === owner` | ✅ | ❌ inline |
| **Project** | `ProjectAccessGuard` + `canEditProject` (shared) | `canEditProject(...)` (shared) | ✅ | ✅ |

The inconsistency: a workspace Owner can edit/delete a member's **pipeline** and **project**, but
**not** their **prompt**. Prompts and pipelines also inline the owner check rather than importing it.

## 3. The rule (one shared primitive)

`packages/shared/src/utils/index.ts`:

```ts
export function canEditOwned(createdBy: string, ctx: MemberCtx): boolean {
  return ctx.role === Role.Owner || createdBy === ctx.userId;
}
```

`canEditProject(p, ctx)` is refactored to delegate: `canEditOwned(p.createdBy, ctx)` — behavior
unchanged, it already encodes exactly this. All three resources now read the rule from one place.

## 4. Changes

### `@lyra/shared`
- Add `canEditOwned(createdBy, ctx)`. Refactor `canEditProject` to delegate.
- Unit test: creator → true, workspace Owner → true, other member → false.

### `apps/api` (the safeguard)
- `prompts/guards/prompt-access.guard.ts` — the `requireOwner` branch switches from
  `if (!isOwner)` to `if (!canEditOwned(prompt.createdBy, ctx))`. **The only behavior change:** a
  workspace Owner can now edit/delete any prompt. The view branch (draft = creator only) is
  unchanged. Build `ctx: MemberCtx` from the membership already loaded in the guard.
- `pipelines/guards/pipeline-access.guard.ts` — replace the inline
  `createdBy !== user.id && role !== Owner` with `!canEditOwned(...)`. Pure DRY, behavior identical.
- Guard specs: extend `prompt-access.guard.spec.ts` (add "workspace Owner can edit/delete"); add the
  missing `pipeline-access.guard.spec.ts` (creator ✓, Owner ✓, other member ✗ on `@RequireOwner`).

### `apps/web` (hide the button)
- `pages/Prompts.tsx` — `canEdit` gains the Owner override via the shared `canEditOwned`
  (read the current membership role the same way `Pipelines.tsx` does, `current?.role`).
- `pages/Pipelines.tsx` — route its `canEdit` through the shared `canEditOwned` too, so no web page
  hand-rolls the rule. (`Projects.tsx` already uses `canEditProject` → now delegates to `canEditOwned`.)

## 5. Out of scope (deliberate)

- **Viewing a draft prompt:** stays creator-only. The Owner override is for edit/delete only.
  (Drafts of others don't appear in the Owner's lists, so this is moot for public prompts; a draft
  is private scratch.)
- **Saved-result deletion:** stays author-or-prompt-creator (no Owner override on `results[]`).
- **No new role tier** (Editor/Viewer) and **no per-resource co-editors** (sharedWith-with-edit).
  Workspace roles remain `Owner` / `Member` + the `canManageKeys` flag.

These are graduation paths, not v1.

## 6. Testing

- **shared:** `canEditOwned` unit test (3 cases); existing `canEditProject` tests still pass (delegation).
- **api:** `prompt-access.guard.spec.ts` gains the Owner-can-edit case; new `pipeline-access.guard.spec.ts`.
- **web:** existing `Prompts.test.ts` / `Pipelines.test.ts` stay green (extend only if they assert `canEdit`).
- Full gate green: `pnpm turbo run type-check lint test build`.

## 7. Files touched (~6)

`packages/shared/src/utils/index.ts` (+ its test), `apps/api/src/prompts/guards/prompt-access.guard.ts`
(+ spec), `apps/api/src/pipelines/guards/pipeline-access.guard.ts` (+ new spec),
`apps/web/src/pages/{Prompts,Pipelines}.tsx`.
