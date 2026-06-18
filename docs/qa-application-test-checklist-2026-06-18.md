# Lyra application QA test cases and checklist

Date: 2026-06-18  
Scope: full app smoke and regression checklist for the current composable
pipelines build.

## Source documents read

- `docs/lyra-pipelines.md`
- `docs/lyra-requirements.md`
- `docs/lyra-getting-started.md`
- `docs/lyra-hosting-cicd.md`
- `CLAUDE.md`
- `docs/workflow.md`

## Current route map

- Public/auth: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`
- App shell: `/`
- Chats: `/chats`, `/chats/:id`
- Prompts: `/prompts`, `/prompts/new`, `/prompts/:id`
- Pipelines: `/pipelines`, `/pipelines/new`, `/pipelines/:id`
- Projects: `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/edit`
- Settings: `/settings`

## Browser smoke results

Checked in the in-app browser against `http://localhost:5173` while logged in.

- Desktop routes `/`, `/chats`, `/prompts`, `/pipelines`, `/projects`, and
  `/settings` rendered without visible page-level error text.
- Desktop library pages loaded data after API settling:
  - Prompts showed prompt rows, filter, new prompt, detail eye, open-in-chat,
    label, and delete actions.
  - Pipelines showed pipeline rows, filter, AI build, open, label, and delete
    actions.
  - Projects showed project rows, filter, inline name/description fields, open,
    and delete actions.
- Create screens rendered without page-level errors:
  - `/projects/new`: disabled create action before required fields, variables
    panel, draft/public status controls.
  - `/prompts/new`: editable title, label/status/model controls, disabled create
    action before required content.
  - `/pipelines/new`: start/end canvas, label controls, AI edit, zoom/fit/tidy,
    disabled create action before required content.
- Mobile width `390x844` smoke passed for `/chats`, `/prompts`, `/pipelines`,
  `/projects`, and `/settings`: no horizontal overflow detected.

## Automated gate checklist

- [ ] `pnpm.cmd turbo run lint type-check test build` passes locally.
- [ ] `@lyra/shared` tests cover pure access/helper rules.
- [ ] `@lyra/api` tests cover auth, encryption, prompts, pipelines, runs, model
  curation, and provider behavior.
- [ ] `@lyra/web` tests cover API wrapper, run actions, flow graph, run UI,
  prompt modal, prompts, pipelines, chats, and key components.
- [ ] No committed secrets or local-only `.env` changes.
- [ ] Worktree diff contains only files intended for the task.

## Manual test cases

### 1. Auth and session

- [ ] Logged-out `/` shows the public landing page.
- [ ] Logged-out direct app route such as `/projects` redirects to `/login`.
- [ ] Signup with valid email/name/password creates a user and lands in the app.
- [ ] Signup rejects invalid email and short password with useful validation.
- [ ] Login with valid credentials succeeds.
- [ ] Login with invalid credentials fails without leaking which field was wrong.
- [ ] Refresh on browser reload restores the session.
- [ ] Logout clears the session and returns to public/auth state.
- [ ] Forgot-password form accepts an email and shows a non-enumerating response.
- [ ] Reset-password rejects invalid or expired token.

### 2. App shell, workspace, preferences

- [ ] Sidebar navigation opens Home, Chats, Prompts, Pipelines, Projects, and
  Settings.
- [ ] Active sidebar item matches the current route.
- [ ] Breadcrumb shows module name on list routes and module/record on detail
  routes.
- [ ] Collapsed sidebar persists after reload.
- [ ] Mobile menu opens, closes from the close button, and closes from the scrim.
- [ ] Workspace switcher lists available workspaces.
- [ ] Workspace switch updates all workspace-scoped data.
- [ ] Language toggle switches English/Vietnamese labels without reload.
- [ ] Theme toggle switches system/light/dark and persists locally.

### 3. Settings and provider keys

- [ ] Settings loads preferences, provider keys, and model sections.
- [ ] Owner or member with `canManageKeys` can add/update a provider key.
- [ ] Member without `canManageKeys` cannot add/update/delete keys.
- [ ] Key list shows only masked key metadata such as `last4`.
- [ ] Full provider key is never visible in API response or UI.
- [ ] Deleting a key removes that provider's unlock state.
- [ ] Refreshing models calls the provider model endpoint and updates the model
  list.
- [ ] Missing key state explains that models are unavailable until a key is set.

### 4. Projects list

- [ ] `/projects` loads without page-level errors.
- [ ] Search filters project rows by visible text.
- [ ] Filter popover opens inside the viewport.
- [ ] Filter clear action is disabled when no filters are active.
- [ ] Filter clear action enables when filters are active and resets the list.
- [ ] Project rows match the compact Prompt/Pipeline list treatment.
- [ ] Editable users can edit project name inline directly in the row.
- [ ] Inline project name saves on blur.
- [ ] Inline project name saves on Enter.
- [ ] Escape reverts unsaved project name draft.
- [ ] Editable users can edit project description inline directly in the row.
- [ ] Inline project description saves on blur.
- [ ] Escape reverts unsaved project description draft.
- [ ] Project name inline field uses Pipeline-list typography: 14px and weight
  500.
- [ ] Project description inline field uses muted 12px text.
- [ ] No pencil/edit icon appears on project rows.
- [ ] Open and delete actions remain visible.
- [ ] Delete asks for confirmation before removing a project.
- [ ] Non-editable projects do not expose inline edit controls.
- [ ] Mobile project rows fit within 390px width without horizontal overflow.

### 5. Project create/edit/detail

- [ ] `/projects/new` renders the EditorShell layout.
- [ ] Create action is disabled until required project fields are valid.
- [ ] Creating a project defaults visibility/status to draft/private behavior
  expected by the current product language.
- [ ] Product, niche, and homepage variables are saved and later fill pipeline
  placeholders.
- [ ] Custom variables can be added, edited, and removed.
- [ ] `/projects/:id` loads project summary without the old separate edit header
  button.
- [ ] Project detail name is inline editable for editable users.
- [ ] Project detail description is inline editable for editable users.
- [ ] Project detail shows status, assigned pipeline count, variable count,
  creator avatar, and created date.
- [ ] Variables panel shows variable chips when variables exist.
- [ ] Variables panel shows a clear empty state when no variables exist.
- [ ] Edit variables link opens `/projects/:id/edit`.
- [ ] Assigned pipeline cards appear on the project hub.
- [ ] Add-from-library assigns an existing pipeline to the project.
- [ ] New pipeline flow can start from the project context.

### 6. Prompts library and editor

- [ ] `/prompts` loads prompt rows without page-level errors.
- [ ] Search filters prompt rows.
- [ ] Multi-select filters use OR within a group and AND between groups.
- [ ] Tag filter matches any selected tag case-insensitively.
- [ ] Long filter groups collapse behind dropdown sections.
- [ ] Prompt row description is clamped to two lines.
- [ ] Prompt detail eye opens the full prompt modal.
- [ ] Prompt detail modal can edit prompt body and save.
- [ ] New prompt editor requires title/body before create.
- [ ] Prompt status can be draft or public.
- [ ] Provider/model selection writes the selected provider/model to the prompt.
- [ ] Media attachments can be added where supported by the current UI.
- [ ] Labels/tags can be added and removed from prompt rows.
- [ ] Open in chat opens existing prompt-origin conversation when one exists.
- [ ] Open in chat otherwise pre-fills a new chat and does not auto-submit.
- [ ] Delete prompt asks for confirmation.
- [ ] Prompt used by a pipeline is protected or warns before destructive changes,
  according to current product behavior.

### 7. Chats

- [ ] `/chats` loads conversation list and composer.
- [ ] New chat starts with empty composer and selected provider/model.
- [ ] Sending a message streams a response over SSE.
- [ ] User message and assistant response auto-persist without manual save.
- [ ] Conversation list updates after a new message.
- [ ] Opening `/chats/:id` restores prior turns.
- [ ] Follow-up turns include previous history as model context.
- [ ] Each message displays its provider/model with `ProviderIcon`.
- [ ] Save as prompt opens the modal for an assistant message.
- [ ] Save as prompt creates a prompt with the message provider/model.
- [ ] Renaming a conversation persists.
- [ ] Deleting a conversation soft-deletes it from the list.
- [ ] Missing provider key or provider error is shown as a recoverable error.
- [ ] Mobile chat layout keeps list, composer, and message content usable.

### 8. Pipelines library

- [ ] `/pipelines` loads pipeline rows without page-level errors.
- [ ] Search filters pipeline rows.
- [ ] Filter popover behavior matches Prompt/Project pages.
- [ ] Pipeline rows have no detail popup.
- [ ] Editable users can inline-rename a pipeline directly from the list.
- [ ] Inline rename saves on blur and Enter.
- [ ] Escape reverts unsaved inline rename draft.
- [ ] Labels/tags can be added and removed from pipeline rows.
- [ ] Row shows step count, creator/date, open, and delete.
- [ ] Delete asks for confirmation.
- [ ] Non-creator non-owner users cannot edit/delete restricted pipelines.
- [ ] Build with AI opens the AI generation flow.
- [ ] Mobile rows fit within 390px width without horizontal overflow.

### 9. Pipeline builder

- [ ] `/pipelines/new` renders the single create/edit builder, not a separate
  form.
- [ ] Start and End nodes render.
- [ ] Add-step control inserts a new step between nodes.
- [ ] Step drawer opens from a step node.
- [ ] Prompt picker searches public prompts only.
- [ ] Step can bind prompt, provider, model, and auto/gate mode.
- [ ] Model dropdown options come from `MODEL_CATALOG`/model API and match the
  selected provider.
- [ ] Reordering steps preserves step content and IDs.
- [ ] Deleting a step removes it from the flow.
- [ ] Saving creates the pipeline on first save.
- [ ] Editing an existing pipeline updates future runs only.
- [ ] Prompt content edits require an explicit shared-update or copy decision.
- [ ] Builder run bar can pick a project.
- [ ] Running from builder auto-saves unsaved edits before creating a run.
- [ ] Builder can return from run mode back to editing.
- [ ] Zoom in, zoom out, fit view, and tidy controls work.
- [ ] Mobile builder uses the one-step pager.

### 10. Runs and run flow

- [ ] Creating a run snapshots the pipeline name, steps, provider/model, mode,
  prompts, and project context.
- [ ] `{product}`, `{niche}`, and `{homepage}` placeholders fill from project
  context.
- [ ] `{input}` receives previous step output.
- [ ] `{step:Name}` can reference earlier step output.
- [ ] Step with missing provider key is locked and cannot run.
- [ ] Run all walks auto steps in order.
- [ ] Gate step pauses with awaiting-gate state.
- [ ] Approve button appears inline for gate steps.
- [ ] Approving a gate resumes the run.
- [ ] Run step executes only that selected step when allowed.
- [ ] Stop cancels or halts an active run and records state.
- [ ] Reset returns run steps to idle or expected reset state.
- [ ] Step prompt can be edited per run before execution.
- [ ] Step result expands/collapses inline.
- [ ] Run rating can be added and persists.
- [ ] Asset list/download/zip endpoints work when assets exist.
- [ ] Provider errors are recorded on the step without corrupting other steps.

### 11. Access control and tenancy

- [ ] JWT payload does not include workspace ID.
- [ ] Every workspace-scoped API request requires a valid workspace membership.
- [ ] Project list honors private/shared/workspace visibility.
- [ ] Workspace owner can see all workspace projects.
- [ ] Member cannot see another member's private project.
- [ ] Creator or owner can edit a project.
- [ ] Non-creator member cannot edit another member's project unless rules allow.
- [ ] Pipeline edit/delete is restricted to creator or workspace owner.
- [ ] Prompt edit/delete permissions match intended library rules.
- [ ] All Mongo queries for workspace resources are scoped by `workspaceId`.
- [ ] Server-only fields `passwordHash`, `encryptedKey`, and `tokenHash` never
  leave the API.

### 12. Files, labels, copilot, and models API

- [ ] File upload accepts supported file types and returns safe file metadata.
- [ ] File read endpoint enforces workspace/project access where applicable.
- [ ] Labels API lists workspace labels.
- [ ] Creating labels avoids unintended duplicates.
- [ ] Label picker reuses existing labels across prompts/pipelines/projects where
  supported.
- [ ] Copilot endpoint returns usable suggestions for supported workspace inputs.
- [ ] Model list endpoint returns curated/fetched models without exposing keys.
- [ ] Provider model refresh requires key-management permission.

### 13. API health and deployment readiness

- [ ] `GET /health` returns success in local/dev environment.
- [ ] Production config disables unsafe secret exposure.
- [ ] Production Mongo auto-index behavior matches hosting guidance.
- [ ] Required Mongo indexes exist or are covered by migrations.
- [ ] CI command matches `pnpm turbo run lint type-check test build`.
- [ ] Build output has no unexpected fatal warnings.

## Regression focus after recent Projects UI work

- [ ] `/projects` project row inline name and description persist after refresh.
- [ ] `/projects` project rows no longer render any pencil/edit action.
- [ ] `/projects` row open/delete actions still work.
- [ ] Project row typography stays aligned with Pipeline row typography.
- [ ] `/projects/:id` inline summary editing still works.
- [ ] Project detail variables panel still links to `/projects/:id/edit`.
- [ ] Mobile project list has no horizontal overflow.

## Suggested automation additions

- Add Playwright auth setup that logs in once and saves storage/session state.
- Add Playwright smoke tests for all protected routes.
- Add Playwright tests for Projects inline name/description edit persistence.
- Add Playwright tests for filter popover clear/collapse behavior across Prompts,
  Pipelines, and Projects.
- Add API e2e tests for project visibility and workspace tenancy.
- Add API e2e tests for pipeline assignment and run snapshot semantics.
- Add web tests for Project list inline edit keyboard behavior.
- Add web tests for Settings key permission states.
