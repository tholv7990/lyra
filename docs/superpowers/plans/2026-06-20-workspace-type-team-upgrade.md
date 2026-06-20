# Workspace Type + Admin-Gated Team Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a workspace's `team` status an admin-approved, one-way upgrade of the user's single owned workspace; gate invites/members to team workspaces; retire free team creation.

**Architecture:** Reuse the existing User Requests module (`apps/api/src/requests`) — a new `team-upgrade` request type carries the requester's `workspaceId`; when the super-admin resolves it, `RequestsService` flips that workspace's `type` to `team` via `WorkspacesService`. Invite creation gains a `type === 'team'` guard. Web: the switcher loses "+ add team", the Members page shows an upgrade prompt on personal workspaces, and the Admin → Requests tab approves upgrades.

**Tech Stack:** NestJS 10 + Mongoose + class-validator (api), React 18 + Vite + react-i18next (web), `@lyra/shared` (zero-dep contracts), Jest + mongodb-memory-server (api tests), Vitest + renderToStaticMarkup (web tests).

## Global Constraints

- **Source of truth:** all enums/DTO interfaces live in `@lyra/shared`; the api implements DTOs as class-validator classes that `implements` the shared interface. Never duplicate types in an app.
- **Build shared after editing it:** `pnpm --filter @lyra/shared build` before api/web type-check (turbo `^build` does this for `build`/`type-check`/`test`).
- **i18n:** every user-facing string goes through `t()` with keys in **both** `src/i18n/locales/en/*` and `.../vi/*`.
- **CSS:** token-only via `var(--…)`; never hardcode hex/px.
- **Web tests:** node env + `renderToStaticMarkup` — no `@testing-library/react`/jsdom.
- **Access control:** enforce via shared helpers; never store workspace in the JWT; scope every query by `workspaceId`.
- **One-way:** no code path anywhere sets a workspace `type` back to `personal`.
- **No data impact:** the upgrade writes only `Workspace.type`; never touch projects/pipelines/keys/runs/memberships.
- **Gate is green only when** `pnpm turbo run lint type-check test build` passes.

## File Structure

**`@lyra/shared`**
- `packages/shared/src/enums/index.ts` — add `WorkspaceType`; add `RequestType.TeamUpgrade`.
- `packages/shared/src/models/index.ts` — retype `Workspace.type` to `WorkspaceType`.
- `packages/shared/src/dto/index.ts` — add `workspaceId?` to `CreateRequestDto`.

**api**
- `apps/api/src/workspaces/workspace.schema.ts` — enum stays string-valued (`Object.values(WorkspaceType)`).
- `apps/api/src/workspaces/workspaces.service.ts` — add `upgradeToTeam(id, actorId)`.
- `apps/api/src/workspaces/invites.service.ts` — `createInvite` rejects non-team workspaces.
- `apps/api/src/workspaces/workspaces.controller.ts` — remove `POST /workspaces` (free team create).
- `apps/api/src/requests/requests.service.ts` — validate team-upgrade on create; flip workspace on resolve.
- `apps/api/src/requests/dto/requests.dto.ts` — add `workspaceId?`.
- `apps/api/src/requests/requests.module.ts` — import `WorkspacesModule`.

**web**
- `apps/web/src/layout/WorkspaceMenu.tsx` — drop the "+ add team" form.
- `apps/web/src/pages/Members.tsx` — personal → upgrade prompt; open request modal.
- `apps/web/src/components/RequestTeamUpgradeModal.tsx` — **new**, mirrors `RequestProviderModal`.
- `apps/web/src/pages/Admin.tsx` — team-upgrade rows show the target workspace; status→resolved approves.
- `apps/web/src/i18n/locales/{en,vi}/{members,admin}.ts` — new strings.

---

### Task 1: Shared contracts (WorkspaceType + TeamUpgrade + request workspaceId)

**Files:**
- Modify: `packages/shared/src/enums/index.ts`
- Modify: `packages/shared/src/models/index.ts`
- Modify: `packages/shared/src/dto/index.ts`

**Interfaces:**
- Produces: `enum WorkspaceType { Personal='personal', Team='team' }`; `RequestType.TeamUpgrade='team-upgrade'`; `CreateRequestDto.workspaceId?: string`; `Workspace.type: WorkspaceType`.

- [ ] **Step 1: Add the enums**

In `packages/shared/src/enums/index.ts`, add near the other workspace/request enums:
```ts
export enum WorkspaceType {
  Personal = 'personal',
  Team = 'team',
}
```
And extend the existing `RequestType`:
```ts
export enum RequestType {
  Provider = 'provider',
  Bug = 'bug',
  TeamUpgrade = 'team-upgrade',
}
```

- [ ] **Step 2: Retype the model + extend the DTO**

In `packages/shared/src/models/index.ts`, import `WorkspaceType` and change the `Workspace` interface field from `type: 'personal' | 'team'` to `type: WorkspaceType`.

In `packages/shared/src/dto/index.ts`, add `workspaceId` to the request create DTO (required by the api only for team-upgrade):
```ts
export interface CreateRequestDto {
  type: RequestType;
  subject: string;
  body?: string;
  workspaceId?: string; // required when type === TeamUpgrade
}
```

- [ ] **Step 3: Build shared + type-check**

Run: `pnpm --filter @lyra/shared build && pnpm --filter @lyra/shared type-check`
Expected: PASS (dual ESM+CJS build, no type errors).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): WorkspaceType enum + TeamUpgrade request type + request workspaceId"
```

---

### Task 2: api — `WorkspacesService.upgradeToTeam`

**Files:**
- Modify: `apps/api/src/workspaces/workspaces.service.ts`
- Test: `apps/api/src/workspaces/workspaces.service.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `WorkspaceType` (shared), `BaseRepository.findOneAndUpdate`.
- Produces: `upgradeToTeam(id: string, actorId: string): Promise<WorkspaceDocument | null>` — sets `type: team` **only when currently personal**; returns the updated doc, or `null` if not found / already team.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/workspaces/workspaces.service.spec.ts`:
```ts
it('upgradeToTeam flips a personal workspace to team and is idempotent', async () => {
  const ws = await service.createPersonal(userId, 'Solo');
  const upgraded = await service.upgradeToTeam(ws.id, userId);
  expect(upgraded?.type).toBe(WorkspaceType.Team);

  // already team → no-op (null), type stays team
  const again = await service.upgradeToTeam(ws.id, userId);
  expect(again).toBeNull();
  const reloaded = await service.findById(ws.id);
  expect(reloaded?.type).toBe(WorkspaceType.Team);
});
```
(Follow the existing service-spec setup — `MongooseModule` against mongodb-memory-server, as in `apps/api/src/admin/admin-users.service.spec.ts`.)

- [ ] **Step 2: Run it — expect FAIL** (`upgradeToTeam is not a function`).

Run: `pnpm --filter @lyra/api test -- workspaces.service`

- [ ] **Step 3: Implement**

In `apps/api/src/workspaces/workspaces.service.ts` add (import `WorkspaceType` from `@lyra/shared`):
```ts
// One-way upgrade: personal → team. Returns null if not found or already team.
upgradeToTeam(id: string, actorId: string) {
  return this.model
    .findOneAndUpdate(
      { _id: id, type: WorkspaceType.Personal },
      { $set: { type: WorkspaceType.Team, updatedBy: actorId } },
      { returnDocument: 'after' },
    )
    .exec();
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workspaces/workspaces.service.ts apps/api/src/workspaces/workspaces.service.spec.ts
git commit -m "feat(api): WorkspacesService.upgradeToTeam (one-way personal→team)"
```

---

### Task 3: api — gate invite creation to team workspaces

**Files:**
- Modify: `apps/api/src/workspaces/invites.service.ts`
- Modify: `apps/api/src/workspaces/invites.module.ts` (or wherever InvitesService is provided) — ensure `WorkspacesService` is injectable there (it's already in `WorkspacesModule`).
- Test: `apps/api/src/workspaces/invites.service.spec.ts`

**Interfaces:**
- Consumes: `WorkspacesService.findById`, `WorkspaceType`.
- Produces: `createInvite(...)` throws `BadRequestException('Invites require a team workspace')` when the target workspace is personal.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/workspaces/invites.service.spec.ts`, add:
```ts
it('createInvite rejects a personal workspace', async () => {
  const ws = await workspaces.createPersonal(ownerId, 'Solo'); // personal
  await expect(
    invites.createInvite({ workspaceId: ws.id, email: 'x@y.z', role: Role.Member, invitedBy: ownerId }),
  ).rejects.toThrow(/team workspace/i);
});

it('createInvite allows a team workspace', async () => {
  const ws = await workspaces.createPersonal(ownerId, 'T');
  await workspaces.upgradeToTeam(ws.id, ownerId);
  await expect(
    invites.createInvite({ workspaceId: ws.id, email: 'x@y.z', role: Role.Member, invitedBy: ownerId }),
  ).resolves.toBeDefined();
});
```

- [ ] **Step 2: Run it — expect FAIL** (personal invite currently succeeds).

Run: `pnpm --filter @lyra/api test -- invites.service`

- [ ] **Step 3: Implement the guard**

In `apps/api/src/workspaces/invites.service.ts`, inject `WorkspacesService` (constructor) and at the top of `createInvite`:
```ts
const ws = await this.workspaces.findById(input.workspaceId);
if (!ws) throw new NotFoundException('Workspace not found');
if (ws.type !== WorkspaceType.Team) {
  throw new BadRequestException('Invites require a team workspace');
}
```
Import `WorkspaceType` from `@lyra/shared` and `BadRequestException`/`NotFoundException` from `@nestjs/common`. Ensure `InvitesService`'s module imports `WorkspacesModule` (which exports `WorkspacesService`); if a circular import arises (workspaces ↔ invites in the same module), inject via the already-shared provider in `WorkspacesModule`.

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workspaces
git commit -m "feat(api): gate invite creation to team workspaces"
```

---

### Task 4: api — team-upgrade request validation on create

**Files:**
- Modify: `apps/api/src/requests/dto/requests.dto.ts`
- Modify: `apps/api/src/requests/requests.service.ts`
- Modify: `apps/api/src/requests/requests.module.ts` (import `WorkspacesModule`)
- Test: `apps/api/src/requests/requests.service.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `WorkspacesService.findById`, `MembershipsService.findFor` (owner check), `WorkspaceType`, `RequestType`.
- Produces: `RequestsService.create` — for `type === TeamUpgrade`, requires `workspaceId`, the caller to be the workspace **owner**, the workspace to be **personal**, and **no existing open** team-upgrade request for it; else throws `BadRequestException`/`ForbiddenException`.

- [ ] **Step 1: Add `workspaceId` to the DTO**

In `apps/api/src/requests/dto/requests.dto.ts`, add to `CreateRequestBody`:
```ts
@IsOptional()
@IsString()
workspaceId?: string;
```

- [ ] **Step 2: Write the failing test**

In `apps/api/src/requests/requests.service.spec.ts`:
```ts
it('team-upgrade create requires owner + personal workspace', async () => {
  const ws = await workspaces.createPersonal(ownerId, 'Solo');
  // non-owner rejected
  await expect(service.create(strangerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: ws.id }))
    .rejects.toThrow();
  // owner ok
  const req = await service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: ws.id });
  expect(req.type).toBe(RequestType.TeamUpgrade);
  // duplicate open request rejected
  await expect(service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: ws.id }))
    .rejects.toThrow();
});
```

- [ ] **Step 3: Run it — expect FAIL.**

Run: `pnpm --filter @lyra/api test -- requests.service`

- [ ] **Step 4: Implement**

In `apps/api/src/requests/requests.module.ts` add `WorkspacesModule` to `imports`.

In `apps/api/src/requests/requests.service.ts` inject `WorkspacesService` + `MembershipsService`, and in `create(actorId, dto, workspaceId?)` before insert, when `dto.type === RequestType.TeamUpgrade`:
```ts
if (dto.type === RequestType.TeamUpgrade) {
  if (!dto.workspaceId) throw new BadRequestException('workspaceId is required');
  const ws = await this.workspaces.findById(dto.workspaceId);
  if (!ws) throw new NotFoundException('Workspace not found');
  if (ws.type !== WorkspaceType.Personal) {
    throw new BadRequestException('Only a personal workspace can request a team upgrade');
  }
  const membership = await this.memberships.findFor(dto.workspaceId, actorId);
  if (membership?.role !== Role.Owner) throw new ForbiddenException('Only the owner can request an upgrade');
  const existing = await this.model.findOne({
    type: RequestType.TeamUpgrade, workspaceId: dto.workspaceId,
    status: RequestStatus.Open, active: { $ne: false },
  }).exec();
  if (existing) throw new BadRequestException('An upgrade request is already pending for this workspace');
}
```
Persist `workspaceId: dto.workspaceId` on the created document (the field already exists on the schema).

- [ ] **Step 5: Run it — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/requests
git commit -m "feat(api): validate team-upgrade request (owner + personal + no duplicate)"
```

---

### Task 5: api — approve a team-upgrade flips the workspace to team

**Files:**
- Modify: `apps/api/src/requests/requests.service.ts`
- Test: `apps/api/src/requests/requests.service.spec.ts`

**Interfaces:**
- Consumes: `WorkspacesService.upgradeToTeam`.
- Produces: `RequestsService.updateStatus` — when a `TeamUpgrade` request transitions to `resolved` and has a `workspaceId`, calls `upgradeToTeam`. Idempotent; decline does nothing.

- [ ] **Step 1: Write the failing test**

```ts
it('resolving a team-upgrade request upgrades the workspace', async () => {
  const ws = await workspaces.createPersonal(ownerId, 'Solo');
  const req = await service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'T', workspaceId: ws.id });
  await service.updateStatus(req.id, { status: RequestStatus.Resolved }, adminId);
  const reloaded = await workspaces.findById(ws.id);
  expect(reloaded?.type).toBe(WorkspaceType.Team);
});

it('declining a team-upgrade does not upgrade', async () => {
  const ws = await workspaces.createPersonal(ownerId, 'Solo');
  const req = await service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'T', workspaceId: ws.id });
  await service.updateStatus(req.id, { status: RequestStatus.Declined }, adminId);
  expect((await workspaces.findById(ws.id))?.type).toBe(WorkspaceType.Personal);
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement the side effect**

In `updateStatus`, after the doc is updated and before returning the view:
```ts
if (doc.type === RequestType.TeamUpgrade && dto.status === RequestStatus.Resolved && doc.workspaceId) {
  await this.workspaces.upgradeToTeam(doc.workspaceId, actorId); // idempotent
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/requests
git commit -m "feat(api): approving a team-upgrade request upgrades the workspace"
```

---

### Task 6: api — retire free team creation

**Files:**
- Modify: `apps/api/src/workspaces/workspaces.controller.ts` (remove the `@Post()` create handler at ~line 51)
- Modify/remove: any `workspaces.controller.spec.ts` test asserting `POST /workspaces` creates a team
- Test: confirm signup still creates a personal workspace (existing auth e2e/service tests cover `createPersonal`).

**Interfaces:**
- Produces: `POST /workspaces` no longer exists. Personal workspaces still come only from `WorkspacesService.createPersonal` (called by `auth.service` on signup) — unchanged.

- [ ] **Step 1: Remove the endpoint**

Delete the `@Post()` `create(...)` method (and the now-unused `CreateWorkspaceBody` import if nothing else uses it) from `workspaces.controller.ts`. Leave rename/members/invites/delete intact.

- [ ] **Step 2: Update tests**

Remove or adjust any spec asserting team creation via the endpoint. Keep the auth tests that assert signup creates a personal workspace.

- [ ] **Step 3: Run the api gate**

Run: `pnpm --filter @lyra/api type-check && pnpm --filter @lyra/api test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/workspaces
git commit -m "feat(api): retire free team creation (POST /workspaces)"
```

---

### Task 7: web — remove "+ add team" from the switcher

**Files:**
- Modify: `apps/web/src/layout/WorkspaceMenu.tsx` (remove the `createWorkspace` form + handler; keep the switcher list)
- Modify: `apps/web/src/workspace/useWorkspace.ts` (remove `createWorkspace` if now unused) — verify no other caller.

**Interfaces:**
- Produces: the switcher lists owned + joined workspaces and switches; no create-team UI.

- [ ] **Step 1: Remove the create form**

In `WorkspaceMenu.tsx`, delete the name input + "create" button + `createWorkspace` call (the block around lines 23/53). Keep the list of workspaces and the active-switch behavior.

- [ ] **Step 2: Drop the now-dead hook method**

Grep `createWorkspace` across `apps/web/src`; if only `WorkspaceMenu` used it, remove it from `useWorkspace.ts`/context.

Run: `pnpm --filter @lyra/web type-check`
Expected: PASS (no dangling references).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/layout/WorkspaceMenu.tsx apps/web/src/workspace
git commit -m "feat(web): remove free team creation from the workspace switcher"
```

---

### Task 8: web — Members page upgrade prompt + request modal

**Files:**
- Create: `apps/web/src/components/RequestTeamUpgradeModal.tsx` (mirror `RequestProviderModal.tsx`)
- Modify: `apps/web/src/pages/Members.tsx`
- Modify: `apps/web/src/i18n/locales/{en,vi}/members.ts`
- Test: `apps/web/src/pages/Members.test.tsx` (renderToStaticMarkup)

**Interfaces:**
- Consumes: `useWorkspace().current.type`, `api`, shared `RequestType`.
- Produces: on a personal workspace, Members renders an upgrade prompt with a button that opens `RequestTeamUpgradeModal`; the modal POSTs `/requests` with `{ type: 'team-upgrade', subject: <team name>, body?, workspaceId: current.id }`.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/pages/Members.test.tsx`, assert that with a personal current workspace the markup contains the upgrade-prompt copy (key `members.upgradeTitle`) and not the member table; with a team workspace it renders members. (Follow the existing node-env render helper used by other web tests.)

- [ ] **Step 2: Run it — expect FAIL.**

Run: `pnpm --filter @lyra/web test -- Members`

- [ ] **Step 3: Build the modal**

Create `RequestTeamUpgradeModal.tsx` modeled on `RequestProviderModal.tsx` (same `.dialog`/`.field`/`.dialog-actions` + `.dialog-close` pattern), fields: team name (`subject`) + optional reason (`body`). On submit:
```ts
await api('/requests', {
  method: 'POST',
  body: JSON.stringify({ type: RequestType.TeamUpgrade, subject: name.trim(), body: note.trim() || undefined, workspaceId }),
});
```

- [ ] **Step 4: Wire the Members page**

In `Members.tsx`, when `current?.type === WorkspaceType.Personal`, render the upgrade prompt + a "Request team upgrade" button that opens the modal (pass `workspaceId={current.id}`); on success show a "request sent" confirmation. Otherwise render the existing members UI.

- [ ] **Step 5: Add i18n (en + vi)**

Add to `members.ts` (both locales): `upgradeTitle`, `upgradeBody`, `upgradeCta`, `upgradeModalTitle`, `upgradeModalSub`, `upgradeNameLabel`, `upgradeNamePlaceholder`, `upgradeNoteLabel`, `upgradeSend`, `upgradeSending`, `upgradeSent`, `upgradeFailed`.

- [ ] **Step 6: Run it — expect PASS + type-check + lint.**

Run: `pnpm --filter @lyra/web test -- Members && pnpm --filter @lyra/web type-check && pnpm --filter @lyra/web lint`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/RequestTeamUpgradeModal.tsx apps/web/src/pages/Members.tsx apps/web/src/pages/Members.test.tsx apps/web/src/i18n/locales/en/members.ts apps/web/src/i18n/locales/vi/members.ts
git commit -m "feat(web): request team upgrade from the Members page (personal workspaces)"
```

---

### Task 9: web — Admin Requests shows team-upgrade context + approves

**Files:**
- Modify: `apps/web/src/pages/Admin.tsx` (the `RequestsSection`/`RequestRow` added for the Requests tab)
- Modify: `apps/web/src/i18n/locales/{en,vi}/admin.ts`

**Interfaces:**
- Consumes: existing `adminApi.requests` / `adminApi.setRequestStatus`; `UserRequest.type === 'team-upgrade'`, `UserRequest.workspaceId`.
- Produces: team-upgrade rows render the `team-upgrade` type label; setting status → `resolved` triggers the server-side upgrade (Task 5). No new endpoint.

- [ ] **Step 1: Surface the type + workspace**

In `RequestRow`, the type badge already renders `admin.reqType.<type>`; add `admin.reqType['team-upgrade']` in both locales (e.g. "Team upgrade"). Optionally show the target `workspaceId` in the meta line. The existing status `<select>` already PATCHes status — resolving fires the upgrade.

- [ ] **Step 2: Type/lint/test**

Run: `pnpm --filter @lyra/web type-check && pnpm --filter @lyra/web lint && pnpm --filter @lyra/web test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Admin.tsx apps/web/src/i18n/locales/en/admin.ts apps/web/src/i18n/locales/vi/admin.ts
git commit -m "feat(web): admin can approve team-upgrade requests (resolve → upgrade)"
```

---

### Task 10: Full gate + manual smoke

- [ ] **Step 1: Run the whole gate**

Run: `pnpm turbo run lint type-check test build`
Expected: all PASS.

- [ ] **Step 2: Manual smoke (dev)**

1. New personal workspace → Members page shows the upgrade prompt (no member table); switcher has no "+ add team".
2. Request upgrade → appears in Admin → Requests as `team-upgrade`.
3. Approve (status → resolved) → workspace shows the team icon, Members area unlocks, invites now allowed.
4. Confirm invites are rejected on a still-personal workspace (api 400).

- [ ] **Step 3: Commit any fixups, then stop for review.**

---

## Self-Review notes (author)

- **Spec coverage:** capability gate (Task 3 invites; Members UI Task 8), own-one (Task 6 + 7), upgrade flow (Tasks 4–5, 8–9), one-way (`upgradeToTeam` only flips personal→team; no reverse path), no-data-impact (only `type` written), migration/grandfather (no migration needed — existing rows keep their type; nothing reads differently). Members-list read on a grandfathered personal-with-members workspace still works (Task 8 only swaps the *editing* UI for the prompt; if you want such workspaces to still show their existing members read-only, render the member list under the prompt — noted for the implementer).
- **Deferred (not in this plan):** approval bell notification (needs notifications backend); these stay out per the spec.
