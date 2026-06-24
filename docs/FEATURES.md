# Lyra — Feature reference (design context)

> The full feature/behavior/function map for mocking up Lyra screens in Claude
> Design. Read with `lyra-design-brief.md` (the brief) and `DATA-MODEL.md` (entities +
> fields). Distilled from the live code (`apps/api/src`, `apps/web/src`,
> `packages/shared`); the code is the source of truth. Each feature lists **What ·
> Behavior · Functions/API · Data · Permissions**.

**Roles** referenced throughout: **Owner** (full control), **Member** (create/run/view),
**Viewer** (read-only). Plus the `canManageKeys` grant and the `emailVerified` gate
(unverified users can browse Home + Marketplace but cannot create or run).

---

## 1 · Access & Tenancy

### Authentication
- **What**: Email/password + Google sign-in, JWT access token + rotating refresh cookie.
- **Behavior**: Signup atomically creates the user + a personal workspace + an Owner membership, and emails a 24h verification link. Login (argon2id) returns a ~15-min JWT (held in memory client-side) + an opaque refresh token in an httpOnly/SameSite=strict cookie (~30-day TTL, rotated every refresh, stored sha256-hashed for revocation). On web load, `/auth/refresh` silently restores the session. Google sign-in uses a CSRF state cookie → Google consent → callback validates the ID token and **auto-verifies** email. Password reset = emailed 1h token; forgot-password always returns 200 (no account-enumeration oracle). Logout revokes the refresh token.
- **Functions/API**: `POST /auth/signup` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/verify-email` · `POST /auth/resend-verification` · Google callback. Web: `AuthContext` (`apps/web/src/auth/AuthContext.tsx`), `Login.tsx`/`Signup.tsx`.
- **Data**: `User` (email, name, emailVerified, isAdmin?) + server-only `passwordHash`, `RefreshToken`, `EmailVerification`, `PasswordReset` (all token-hashed).
- **Permissions**: Public: signup/login/refresh/forgot/reset/verify/Google. Authed: change-password, resend-verification, `/auth/me`.

### Email verification (gate)
- **What**: Confirm email before creating workspace content.
- **Behavior**: Unverified users sign in but a create-gate blocks `POST /workspaces|projects|pipelines|runs` and chat sends. The notification bell shows a "Confirm your email" row with **Resend**. Google sign-ups are pre-verified.
- **Permissions**: Verified email required for all create/run actions (`enforceCreateGate`).

### Workspaces
- **What**: The tenant; owns all projects/prompts/pipelines/keys/runs. Personal (auto on signup) or Team.
- **Behavior**: Personal workspaces can't be deleted; Team workspaces are reached by a **one-way personal→team upgrade** (admin-approved `team-upgrade` request). The sidebar **switcher** lists workspaces you're a member of (persisted in localStorage `lyra.workspaceId`). Every request targets a workspace via `/workspaces/:id/...` or `X-Workspace-Id`; a guard verifies membership per request and scopes every query by `workspaceId` (workspace is **not** in the JWT).
- **Functions/API**: `GET /workspaces` (each annotated with your role + canManageKeys) · `GET/PATCH/DELETE /workspaces/:id` (rename/delete = Owner; delete forbidden on personal). Web: `WorkspaceMenu.tsx`, `WorkspaceContext`.
- **Data**: `Workspace` (name, type), `WorkspaceView` (+ role, canManageKeys).
- **Permissions**: See only your workspaces. Rename/delete/upgrade = Owner.

### Members & invites
- **What**: Manage who's in a workspace and their role.
- **Behavior**: One active `Membership` per (workspace, user). Owner can list members, change roles (`Owner|Member|Viewer`), grant `canManageKeys`, and soft-remove members (can't demote/remove the **last Owner**). Invites: Owner creates one by `{email, role}` → a high-entropy token (sha256-hashed, 7-day TTL index) + an accept URL; status `pending → accepted|revoked|declined`. Accept validates token+expiry+email and creates the membership idempotently; in-app accept/decline by the invitee's email. Pending invites surface in the **notification bell** (enriched with workspace name + inviter).
- **Functions/API**: `GET /workspaces/:id/members` · `PATCH|DELETE /workspaces/:id/members/:uid` · `POST /workspaces/:id/invites` · `DELETE /workspaces/:id/invites/:iid` · `POST /invites/accept` · `GET /invites/mine` · `POST /invites/:id/accept|decline`. Web: `Members.tsx`, `NotificationBell.tsx`, `useInvites`.
- **Data**: `Membership`, `Invite`, `MyInvite`.
- **Permissions**: Member management = Owner. Invites require a Team workspace + Owner.

### Roles & permissions (guard chain)
- **Owner**: invite, rename, change roles, manage keys, create/run.
- **Member** (+ verified): create projects/pipelines/prompts, run pipelines.
- **Viewer**: browse only — no create/run/manage.
- Enforced by `JwtAuthGuard → WorkspaceGuard (membership + role + canManageKeys) → ProjectAccessGuard (visibility)`, plus `@RequireOwner` / `@RequireCreate` / `@RequireManageKeys` decorators. Both api and web read the **same** shared helpers (`canViewProject`, `canEditProject`, `canManageKeys`, `canCreate`).

### Notifications (bell)
- **What**: Email-verify prompt + pending invites.
- **Behavior**: Fetches `GET /invites/mine` on mount/focus. Cards: system ("confirm email" → Resend) and invites (workspace, inviter, role → Accept/Decline). Badge count capped 9+, 5/page, dismiss persists in localStorage.

---

## 2 · Projects & Tasks

### Projects
- **What**: A workspace board of tasks for one brand/product.
- **Behavior**: Created **draft** (private to creator + Owners); publishing sets reach via `shared: all` (whole workspace) or `shared: people` + `sharedWith[]`. Carries `variables[] {key,value}` (e.g. `product`, `niche`, `homepage`) that fill `{key}` placeholders in pipelines at run time. The project **is the task board** — pipelines live on Tasks, not the project. Supports **transfer** personal→team (bundles tasks/pipelines/prompts, with conflict detection). Soft-deleted.
- **Functions/API**: `POST /workspaces/:id/projects` · `GET /workspaces/:id/projects` · `GET|PATCH|DELETE /projects/:id` · `POST /projects/:id/transfer[/preview]`. Web: `ProjectDetail.tsx` (read view = title in nav, description → info → task board), `ProjectEditor.tsx`.
- **Data**: `Project` (name, description, variables[], status, shared, sharedWith[]).
- **Permissions**: `canViewProject` (Owner override; creator; public+shared). `canEditProject` (Owner or creator; Viewer never).

### Tasks (board cards)
- **What**: Units of work on the board; hold the pipelines that produce output.
- **Behavior**: Created **New**; the detail page sets status (`new|in_progress|on_hold|complete`), priority (`none|urgent|high|medium|low`), assignee (a workspace member), tags (workspace labels), and assigned `pipelines[]`. Each assigned pipeline runs independently; **Runs are scoped to (taskId, pipelineId)** and listed on the task. List view is Linear-style grouped-by-status; mobile = cards. Edit name/description in a dedicated `TaskEditor` page.
- **Functions/API**: `GET|POST /projects/:id/tasks` · `GET|PATCH|DELETE /projects/:id/tasks/:taskId`. Web: `TaskList.tsx`, `TaskDetail.tsx`, `TaskEditor.tsx`, status/priority/label pickers (`MenuPicker`).
- **Data**: `Task` (status, priority, assignee?, pipelines[], tags[]).
- **Permissions**: Mutations require project-edit (`@RequireCreate` + `ProjectAccessGuard`).

---

## 3 · API Keys & Model Catalog

### API keys (BYO, encrypted)
- **What**: Per-workspace, per-provider AI keys you bring yourself (no billing v1).
- **Behavior**: Stored **AES-256-GCM** encrypted at rest (`ENCRYPTION_KEY` master, IV:authTag:ciphertext) — only **last4** ever leaves the api. One active key per (workspace, provider). The run engine fetches the decrypted key per step; **per-step gating**: a step is runnable only if the workspace has a key for that step's provider (exception: **Crawl** needs none).
- **Functions/API**: `GET /workspaces/:id/keys` (any member) · `PUT|DELETE /workspaces/:id/keys/:provider` (canManageKeys). Web: `Settings.tsx`, `AddKeyModal`.
- **Data**: `ApiKey` (provider, last4) + server-only `encryptedKey`; transport = `ApiKeyInfo`.
- **Permissions**: Read = members. Write/delete = `canManageKeys`.

### Provider / model catalog
- **What**: The model list shown in step/chat pickers, per workspace per provider.
- **Behavior**: Effective catalog = stored `ProviderModel` (if refreshed from the live provider API + curated to flagship models) else the built-in `MODEL_CATALOG` default. Refresh is a live API call (spend), so it needs a key + `canManageKeys` + verified.
- **Functions/API**: `GET /workspaces/:id/models` · `POST /workspaces/:id/keys/:provider/models` (refresh).
- **Data**: `ProviderModel`, `ModelOption {id,label}`, `MODEL_CATALOG`.

---

## 4 · Prompts, Chats, Marketplace

### Prompt library
- **What**: Reusable, parameterized prompts owned by the workspace.
- **Behavior**: Created **draft** (creator-only visibility) → publish to the workspace (public = all members). Fields: title, content with `{variable}` placeholders (parsed), `type` (text/image/audio/video — metadata badge + filter), media[], tags (deduped, case-insensitive), default provider·model. A prompt **owns saved results** (`results[]`): any member viewing it can save an answer from a chat (records author + `promptSnapshot`); author/owner can edit (rating/note) or delete a result. List is paginated + filterable (status/tag/type/provider/createdBy/q) with facet vocabularies. **Edit/delete = creator only** (by design).
- **Functions/API**: `POST|GET /workspaces/:id/prompts` · `GET /…/prompts/{tags,creators,providers}` · `GET|PATCH|DELETE /prompts/:id` · `POST|PATCH|DELETE /prompts/:id/results[/:resultId]`. Web: `Prompts.tsx`, `PromptDetails.tsx` (read view + `SavedResults` rail), `PromptEditor.tsx`.
- **Data**: `Prompt` (status, type, media[], tags[], provider?, model?, results[]), `SavedResult`.
- **Permissions**: Edit/delete = creator. Public visible to all; drafts to creator. Save result = any viewer; mutate result = author/owner.

### Chats (Conversations)
- **What**: A top-level, Claude-style multi-turn assistant — the prompt iteration workshop. Reached from a bottom-right **AI FAB**.
- **Behavior**: Per-user, soft-deleted. First message lazily creates the chat. The composer prefills when opened from a prompt (stamps `originPromptId`). Send streams the reply over **SSE** (`delta`→`done`→`error`) with prior turns as text-only history; the current turn may carry media (images + PDFs, ≤5). Every turn auto-persists, stamped with its `provider·model`. Title auto-derives from the first user line. **Save as prompt** promotes an answer to a new library Prompt (carries content+media+provider·model) and links the chat (`originPromptId`) + auto-saves the answer as a result. **Open in chat** never auto-submits — it opens the latest existing conversation for that prompt (matched by `originPromptId` or legacy first-message content) or opens `/chats` with the composer prefilled and waits.
- **Functions/API**: `POST|GET /workspaces/:id/conversations` · `POST /…/conversations/prompt-history` · `GET /conversations/:id` · `POST /conversations/:id/messages` (SSE) · `PATCH|DELETE /conversations/:id`. Streaming via `anthropic.client` / `openai-compat.client` (history support). Web: `Chats.tsx`, `SaveAsPromptModal`, `ProviderIcon`.
- **Data**: `Conversation` (title, provider, model, originPromptId?, starred, messages[]), `ConversationMessage` (role, content, media?, provider, model, usage?, error?).
- **Permissions**: Creator-only. Verified email required to send.

### Prompt marketplace
- **What**: A global, read-only CC0 catalog (imported from prompts.chat) you can browse and **adopt**.
- **Behavior**: prompts.chat-style card gallery with **Search · ✨AI · + Filter** (type/category/tags, OR-within-group / AND-across-groups). The **AI** button ranks the free-text need via Claude (needs a workspace Anthropic key) → `RankedMarketplacePrompt` (score 0-100 + reason). **Adopt** copies a catalog item into the library as a Draft Prompt (converts `{{var}}`→`{var}`, preserves tags). The dev catalog is a curated ~138 dropshipping set — **don't run admin "Catalog sync"** (it overwrites it).
- **Functions/API**: `GET /workspaces/:id/marketplace/prompts` · `GET /…/marketplace/facets` · `POST /…/marketplace/rank` · `POST /…/marketplace/adopt`. Web: `Marketplace.tsx`, `MarketplaceDetails`, `PromptCodeBlock`.
- **Data**: `MarketplacePrompt` (description?, category?, type text|structured, variables[], tags[]), `MarketplaceFacets`.
- **Permissions**: Browse/search/rank = members. Adopt requires verified. Catalog read-only; sync = super-admin.

---

## 5 · Pipelines & the Run Engine

### Composable pipelines
- **What**: A reusable workspace-library resource — an ordered, **linear** chain of Steps.
- **Behavior**: Each `PipelineStep` binds a library **Prompt** (`promptId`) to a **provider·model** + a **mode** (`auto` = auto-advance, `gate` = pause for approval). Pipelines also carry custom `variables[]` (`{token}` + label + default) and an `origin` (ai|manual + goal/model). The **builder** is the single create+edit surface (`/pipelines/new` opens it; first save creates). The step drawer's **PromptPicker** lists **public** prompts only; a step with empty `promptId` is a "needs a prompt" gap that blocks save. Pipelines are assigned to **Tasks** and run in a project's context; deleting a pipeline pulls its id out of every task.
- **Functions/API**: `POST|GET /workspaces/:id/pipelines` · `GET|PATCH|DELETE /pipelines/:id` · `POST /…/pipelines/generate` + `/ai-chat` (AI builder). Web: `PipelineBuilder.tsx`, `PromptPicker.tsx`, `EditorShell`, `FlowPager`.
- **Data**: `Pipeline` (steps[], variables[], origin?), `PipelineStep`, `PipelineVariable`.
- **Permissions**: Create/edit = Owner/Member (creator or Owner to edit). Viewers can't.

### AI pipeline builder
- **What**: Generate a draft pipeline from a natural-language goal, grounded to the real prompt library.
- **Behavior**: A goal → Claude reads the workspace's public prompts (+ top-rated runs as few-shot) → returns `{name, description, steps[]}` validated against real prompt ids (unknown → gap steps with a suggestion). The draft is **never persisted** — it pre-fills the builder. Conversational mode (`ai-chat`) replies in words and attaches a draft when concrete. `origin` records it was AI-designed (seeds future "learn from good pipelines").
- **Functions/API**: `POST /workspaces/:id/pipelines/generate` · `/ai-chat`. Service: `PipelineAiService`.
- **Data**: `GeneratedPipeline`, `GeneratedStep`, `PipelineOrigin`.

### Runs (state machine)
- **What**: One execution of a pipeline against a task; a persisted state machine.
- **Behavior**: Create flows: single-pipeline on a task, **run-all** (one run per assigned pipeline), or a builder **test-run** (no project). At creation the run **snapshots & freezes**: the steps, each step's resolved prompt, the merged variables, and collections — so later edits don't leak in. Statuses: `idle → running → awaiting_gate → done | error`; per-step `idle | queued | running | waiting | skipped | done | error`. **run-all** advances step by step until a gate, the end, or an error. A **gate** pauses (`awaiting_gate`/`waiting`) until **Approve**. A **condition** that fails **skips** the step (no provider call, run continues). On error the run halts. Users can edit a step's prompt, **stop**, **reset**, and **rate** the run 👍/👎.
- **Functions/API**: `POST /projects/:id/tasks/:taskId/pipelines/:pipelineId/runs` · `…/runs/all` · `POST /workspaces/:id/pipelines/:pipelineId/test-runs` · `GET /projects/:id/tasks/:taskId/runs` · `GET /runs/:id` · `POST /runs/:id/{run-all,stop,reset}` · `POST /runs/:id/steps/:i/{run,approve}` · `PATCH /runs/:id/steps/:i/prompt` · `PATCH /runs/:id/rating`. Pure transitions in `run.engine.ts` (no I/O); orchestration in `runs.service.ts`.
- **Data**: `Run` (status, currentStep, steps[], variables, collections, rating?), `Step` (status, model, prompt, sentPrompt?, result?, assetIds?, usage?, error?).
- **Permissions**: `ProjectAccessGuard` → task → run; `@RequireCreate` to run.

### Variables, chaining, conditions, fan-out
- **Variables** (frozen at run start): resolved from project `variables` + pipeline custom `variables` (with defaults, overridable at run-start) + system `{note}` (pipeline description) / `{date}`. `fillPrompt` replaces `{key}` at run time.
- **Chaining**: `{input}` = the latest prior step result; `{step:Name}` = a named earlier step's result. When a prompt uses these, prior results aren't auto-appended (avoids duplication); otherwise prior outputs are appended as context.
- **Conditions** (`StepCondition {variable, op, value?}`, ops `eq|ne|contains|exists|empty|gt|lt`): if it fails, the step is **skipped**.
- **Fan-out** (`FanOutConfig {over, itemVar?}`): maps the step's prompt over a named run collection — one provider call per item, parallel (≈4 concurrency, 2 retries), partial failure tolerated (outputs merged). Run-start surfaces variables/collections in a modal.

### Provider registry & step execution
- **What**: Dispatch each step to its provider implementation via one `StepProvider.execute()` interface.
- **Behavior**: `ProviderRegistry` maps `Provider → StepProvider`. Implementations: **Anthropic** (brain steps, real Claude calls), OpenAI-compatible (OpenAI/DeepSeek), **Crawl** (URL → images+text, no key), **Image** (gpt-image-1), and a deterministic **MockStepProvider** fallback for anything not yet wired. Each call gets the decrypted per-workspace key; swapping a model is a one-line registry change.
- **Data**: `StepRunContext` (step, apiKey, priorResults), `StepRunOutput` (result, assets?, usage?).

### Run results, assets & workbench
- **Behavior**: A step persists `result` (Markdown) + creates `Asset` docs (image/video/audio) whose ids stamp onto `step.assetIds`. Assets are downloadable individually or as a per-step zip. The **unified run view** `RunFlow` lights up the same vertical flow as the builder with live per-step status, inline gate **Approve**, editable step prompts, and expandable results (+ prior-run history). Mobile folds into a one-step **FlowPager**. Shared plumbing: `useRunActions.ts` (`runAll/runStep/approve/stop/reset/savePrompt`). Run ratings seed the AI builder's few-shot.
- **Functions/API**: `GET /runs/:id/assets` · `/assets/zip` · `/assets/:assetId/download`. Web: `RunFlow.tsx`, `RunStepCard.tsx`, `StepResultModal.tsx`, `ProjectDetail.tsx` (hub).
- **Data**: `Asset`, `RunRating`.

---

## 6 · Connectors (Publish + Media import)

> Lyra holds the UI + a thin proxy; the connector logic runs in a separate
> **connectors microservice** (Postiz for publish, Cobalt/yt-dlp for download).

### Publish (Postiz)
- **What**: Compose once, post to many social channels.
- **Behavior**: Save a Postiz API key (encrypted, last4 only). Pick channels (fetched live from Postiz), write a caption (≤2200) + media URLs, **Publish** → a `PublishJob` (`queued → running → done|failed`) polled until done, with a per-channel **Receipt** (`ok|failed` + post URL). Partial failure tolerated. Platforms: tiktok/instagram/youtube/facebook/x/…
- **Functions/API**: `PUT|GET /workspaces/:id/connectors/credentials` · `GET /…/connectors/{connect-link,channels}` · `POST /…/connectors/publish` · `GET /…/connectors/jobs/:jobId`. Web: `PublishComposer.tsx`, `lib/connectors.ts`.
- **Data**: `PublishJob`, `Receipt`, `Channel`, `ConnectorCredentialInfo`.
- **Permissions**: Save creds = canManageKeys. Publish = verified member.

### Media import / Crawler (Cobalt/yt-dlp)
- **What**: Paste a link → resolve media (carousel-aware) → download in a chosen quality with live progress.
- **Behavior**: `resolve` returns `MediaItem[]` (video/image/audio, each with `qualities[]` = yt-dlp `-f` selectors, sorted high→low). Pick a quality → **download** → a `DownloadJob` (`running → done|error`, `pct` 0-100) polled ~0.8s → files auto-download (proxied through Lyra). Carousels return many indexed items (download all or a subset). Optional encrypted **cookies.txt** (Netscape format, never returned) is injected server-side for gated/age-restricted content. Files + jobs are TTL-swept (~15 min).
- **Functions/API**: `POST /…/connectors/resolve` · `POST /…/connectors/download` · `GET /…/connectors/download-jobs/:jobId` · `GET /…/connectors/files/:fileId` · `PUT|GET|DELETE /…/connectors/cookies`. Web: `ImportMedia.tsx`.
- **Data**: `MediaItem`, `MediaQuality`, `DownloadJob`, `CrawlerCookieInfo`.
- **Permissions**: Resolve/download = verified member. Manage cookies = canManageKeys.

---

## 7 · Admin & user requests

### Super-admin panel
- **What**: Platform dashboard + user management + request triage, behind a `SUPER_ADMIN_EMAILS` allowlist.
- **Behavior**: `/admin` (revealed only when `user.isAdmin`, but the **api guard is the real gate**) has tabs: **Overview** (counts of users/workspaces/projects/pipelines/prompts/runs/chats + 30-day signups + recent), **Users** (searchable, paged → detail with workspaces + usage + active toggle; can't self-deactivate), **Requests** (filter by type/status; resolve/decline with a note; resolving a `team-upgrade` auto-upgrades the workspace), **Platform** (catalog stats + a ⚠️ Sync button — do not run; it overwrites the curated marketplace).
- **Functions/API**: `GET /admin/overview` · `GET /admin/users[/:id]` · `PATCH /admin/users/:id` · `GET|PATCH /admin/requests[/:id]` · `GET|POST /admin/marketplace/{stats,sync}`. Web: `Admin.tsx` (card galleries).
- **Data**: `AdminOverview`, `AdminUserSummary`, `AdminUserDetail`, `AdminUserUsage`.
- **Permissions**: `AdminGuard` + allowlist (server-side only).

### User requests
- **What**: Users submit provider requests / bug reports / team-upgrade requests; admins triage.
- **Behavior**: `POST /requests {type, subject, body?, workspaceId?}` → a `UserRequest` (`open`, `voteCount` reserved for a future voting board). A `team-upgrade` requires a personal workspace the requester owns (one open per workspace). Admin resolves/declines with a note; resolving an upgrade calls `upgradeToTeam`.
- **Functions/API**: `POST /requests` · `GET|PATCH /admin/requests`.
- **Data**: `UserRequest` (type, subject, status, voteCount, adminNote?).
- **Permissions**: Create = any signed-in user. Triage = super-admin.

---

## 8 · Permissions at a glance

| Action | Owner | Member | Viewer | Notes |
|---|---|---|---|---|
| Browse Home/Marketplace | ✓ | ✓ | ✓ | unverified too |
| Create project/pipeline/prompt, run | ✓ | ✓ | ✗ | requires verified email |
| Edit/delete a prompt | creator only | creator only | ✗ | by design |
| Edit/delete a project | ✓ (override) | creator | ✗ | `canEditProject` |
| Manage API keys / connector creds / cookies | ✓ | if `canManageKeys` | ✗ | `@RequireManageKeys` |
| Invite, change roles, rename/delete workspace | ✓ | ✗ | ✗ | `@RequireOwner` |
| Admin panel | super-admin allowlist only | | | `SUPER_ADMIN_EMAILS` |

Cross-cutting invariants: workspace is **not** in the JWT (membership verified per request, every query scoped by `workspaceId`); server-only fields (`passwordHash`/`encryptedKey`/`tokenHash`) never leave the api; access rules come from shared helpers so api and web agree.
