# Workspace personal/team model — admin-gated upgrade + move-to-team

**Date:** 2026-06-20
**Status:** Design approved, pending spec review
**Scope:** Two related changes to the workspace model. A separate spec covers the Task layer.

## Problem & goals

Today every workspace already carries `type: 'personal' | 'team'`, but the type is
cosmetic and immutable, and any user can freely create unlimited team workspaces
via the switcher. We want:

1. **A user owns exactly one workspace** (their personal one, created at signup).
   To turn it into a team they **request the platform admin**, who approves the
   upgrade. Team status unlocks **members/invites**; that is the only functional
   difference. The flip is **one-way** (no team → personal) and **must not touch
   any data** — it is purely a capability flag.
2. **Move personal work into a team.** Once someone is in a team, they can move a
   project (with the pipelines and prompts it depends on) from their personal
   workspace into the team. Moving **re-points ownership** (no duplicate), is
   **one-way**, and the mover keeps access as a team member.

Users can still be **members of other people's teams** via invite (the switcher
lists those). "Own one workspace" constrains *ownership/creation*, not membership.

## Non-goals

- No team → personal downgrade, anywhere in API or UI.
- No automatic merge of personal data on join (only the explicit move in 1b).
- No "export my contributions on leave" (noted as a future add-on).
- No billing/limits tied to team status (members/invites only).
- The Task layer is out of scope (separate spec).

---

## Change 1 — Workspace type + admin-gated team upgrade

### Data model (`@lyra/shared`)

- Add `enum WorkspaceType { Personal = 'personal', Team = 'team' }`; replace the
  inline `'personal' | 'team'` literals in the `Workspace` interface and the
  Mongoose schema enum. No new fields on `Workspace`.
- Add `RequestType.TeamUpgrade = 'team-upgrade'` to the existing requests enum.
- `CreateRequestDto` gains an optional `workspaceId?: string` (required when
  `type === team-upgrade`; ignored otherwise). `UserRequest` already has
  `workspaceId`.

### Capability gating (the meaning of "team")

- **Invites + Members require `type === 'team'`.**
  - API: invite-create and member-mutation endpoints reject with 400 when the
    workspace is personal.
  - Web: the **Members page** (`apps/web/src/pages/Members.tsx`) renders an
    **upgrade prompt** instead of the member list when the current workspace is
    personal.
- Everything else (projects, pipelines, prompts, keys, runs) is identical for
  personal and team. No other code path branches on type beyond invites/members
  and the existing "can't delete your personal workspace" rule.

### Ownership — own one

- Retire the switcher's free **"+ add team"** create form
  (`apps/web/src/layout/WorkspaceMenu.tsx`) and the `POST /workspaces` team-create
  endpoint. The switcher still lists the owned workspace + any teams the user was
  invited to, and still switches the active context.
- Signup still creates the one personal workspace (unchanged).

### Upgrade flow (reuses the User Requests module)

1. On a personal workspace, the Members page shows "This is a personal
   workspace — request to upgrade to a team" → a modal (team name + optional
   reason) → `POST /requests` with `{ type: 'team-upgrade', subject: <team name>,
   body?: <reason>, workspaceId: <current workspace id> }`.
   - API validates: the requester **owns** that workspace (is its `owner`
     membership) and it is currently **personal**. Rejects duplicates (an open
     team-upgrade request already exists for that workspace).
2. **Admin → Requests** shows team-upgrade rows with an **"Approve & upgrade"**
   action. Approval is `PATCH /admin/requests/:id { status: 'resolved' }`; the
   request service, seeing `type === team-upgrade` transition to `resolved` with
   a `workspaceId`, **flips that workspace's type to team** (idempotent — only if
   still personal). Decline just marks the request declined; no side effect.
3. After approval the requester's workspace shows the team icon and the Members
   area unlocks on next load. (A bell notification waits for the real
   notifications backend — out of scope.)

### One-way & no data impact

- No endpoint or UI sets a workspace back to personal.
- The upgrade writes a single field (`type`). Projects, pipelines, prompts, keys,
  runs, and existing memberships are untouched.

### Migration (grandfather)

- Existing workspaces keep their current type and members. Only the *future*
  create path changes. Users who already own multiple workspaces keep them; no
  consolidation or deletion. Personal workspaces that already have members (from
  before this change) are grandfathered as-is.

### API surface (Change 1)

- `POST /requests` — extended to accept `workspaceId`; validates ownership + personal for team-upgrade.
- `PATCH /admin/requests/:id` — team-upgrade + resolved triggers the workspace type flip (in `RequestsService`, calling into `WorkspacesService`).
- Invite-create / member-mutation endpoints — add a `type === 'team'` guard.
- `POST /workspaces` (free team create) — removed.

---

## Change 1b — Move personal work into a team

### Mechanism

- Moving re-points the resource's `workspaceId` from the personal workspace to
  the target team. **No duplicate.** **One-way** — no endpoint moves anything from
  a team back to personal.

### Granularity — project bundle

- Moving a **project** moves a self-contained bundle together, in one transaction,
  re-pointing every `workspaceId`:
  - the **project**,
  - its **tasks** (once the Task-layer spec ships — pipelines attach to tasks then,
    not the project),
  - the **pipelines** those tasks reference (`task.pipelines[]`; today
    `project.pipelines[]`),
  - the **prompts** those pipelines' steps reference.

  > Cross-spec note: until the Task layer lands, the bundle is project +
  > `project.pipelines[]` + prompts. After it lands, pipelines come via the
  > project's tasks. Build order decides which is in effect; the transfer logic
  > should read pipelines from wherever they live at implementation time.
- **Leaf moves** are also allowed: a lone prompt or a lone pipeline (with its
  prompts) can move on its own.
- **Shared-dependency guard:** if a pipeline/prompt in the bundle is also
  referenced by a project/pipeline the user is **keeping** in personal, the move
  would orphan that reference (cross-workspace references are not allowed). The
  flow surfaces these conflicts in a **preview** and the user must resolve before
  confirming. (Resolution options are listed under Open questions.)

### Permissions

- Only the resource's **owner** (`createdBy === user`) can move it.
- The target must be a **team the user is a member of with create rights**
  (owner/member, not Viewer — reuses the existing `canCreate` gate).

### Provider keys on move (never touched)

A provider key is a per-workspace, bring-your-own credential that **spends its
owner's money/quota** (invariant 7). A move therefore **never copies or relocates
a key** — silently carrying a personal key into a team would make the whole team
spend on the mover's bill, which must be a deliberate act, not a side effect.

- The **transfer preview lists which providers the moved pipelines need** (e.g.
  "uses OpenAI, Anthropic") and warns that the **team must have its own key** for
  each.
- If the team lacks a key, the affected steps **lock** under the existing
  per-step key gating until a team key-manager adds one. **No data is lost** — the
  pipeline just can't run yet.
- The mover can still **deliberately** add their own key to the team afterward via
  the normal Settings → add-key flow (with full awareness the team will spend on
  it). That is a separate, explicit action — not part of the move.

### Visibility on landing

- The moved project becomes **workspace-visible** in the team so members can use
  it (that is the point of moving). `createdBy` is preserved, so it still reads as
  the mover's contribution.

### Leaving the team

- A member who leaves (or is removed) loses **access** to team data, including
  what they moved/created. The data is **not destroyed** — it stays with the team.
  This is the direct consequence of "team data can't become personal." The move UI
  **warns** at confirm time: "This moves X into <team>. You'll work with it there,
  and it stays with the team."

### API surface (Change 1b)

- `POST /projects/:id/transfer/preview { targetWorkspaceId }` → returns the bundle
  (projects/pipelines/prompts that will move) + any shared-dependency conflicts.
- `POST /projects/:id/transfer { targetWorkspaceId }` → performs the move in a
  Mongo transaction; rejects if conflicts are unresolved.
- `POST /pipelines/:id/transfer { targetWorkspaceId }` and
  `POST /prompts/:id/transfer { targetWorkspaceId }` for leaf moves.
- All transfer endpoints validate: source is the user's personal workspace,
  caller owns the resource, target is a team the caller can create in.

### Web

- A **"Move to team"** action on the project detail page (and on prompt/pipeline
  rows for leaf moves), shown only when the current workspace is personal and the
  user has a team to move into. Opens a target picker → preview (bundle +
  conflicts) → confirm with the warning copy.

---

## Testing strategy

- **shared** — `WorkspaceType` enum used by the model; no new pure helpers unless
  a `canMoveResource`-style guard emerges (then unit-test it).
- **api** —
  - Request service: team-upgrade approval flips type only when personal +
    owner; idempotent; decline is a no-op.
  - Invite/member guards reject on personal, allow on team.
  - Transfer service: bundle gathered correctly; shared-dependency conflict
    detected; transaction re-points all `workspaceId`s; rejects non-owner,
    non-personal source, viewer target. Test against mongodb-memory-server.
- **web** — Members page shows upgrade prompt on personal; transfer preview lists
  the bundle + conflicts (renderToStaticMarkup, per the no-RTL convention).

## Open questions / future

- **Shared-dependency resolution** in 1b preview: the simplest first cut is to
  **block** the move and tell the user which projects share the dependency, so
  they detach or move those too. A later refinement could offer "duplicate the
  shared dependency so both sides keep working" — deferred.
- **Export-on-leave** for departing members — deferred add-on.
- **Approval notification** to the requester (bell) — waits for the notifications
  backend.
- Exact team-visibility value to set on a moved project depends on the live
  `ProjectShare` model (`shared`/`sharedWith`); pin during implementation.
