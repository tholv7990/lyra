# Latest session handoff - June 17, 2026

Open this file first in the next session. Branch: **dev**. There is a large amount of uncommitted work in this repo; do not reset or discard unrelated files.

There is **no active blocked implementation task** from the latest session. Continue from the user's next request.

Recent changes on disk:
- `/prompts`, `/pipelines`, and `/projects` now share a compact Linear-style list/card UI. The shared filter popover is viewport-clamped, has a Clear button that enables only when menu filters are selected, and uses collapsible sections for long groups (`Tags`, `Created by`).
- Prompt filtering is multi-select. Semantics are OR within a filter group and AND between groups. Prompt tag filtering was fixed in `apps/api/src/prompts/prompts.service.ts` with exported `buildPromptListFilter()` and regression test `apps/api/src/prompts/prompts.service.spec.ts`; selected tags mean "has any selected tag" and are case-insensitive.
- Prompt rows were redesigned: two-line description clamp, eye button opens `PromptDetails`, prompt details can edit body, colored updated-by avatar, provider icon/model, chat icon action, danger X delete.
- Pipeline rows now have no detail popup and no eye icon. Editable users can inline rename and edit tags from the list; rows show description, tags, step count, creator/date, open, and delete.
- Project create/edit (`apps/web/src/pages/ProjectEditor.tsx`) was redesigned on `EditorShell`: project name in the header; grouped context fields for `product`, `niche`, `homepageUrl`; visibility uses selectable cards and is available on create and edit.

Focused checks run after the latest edits:
```bash
pnpm.cmd --filter @lyra/api test -- prompts.service
pnpm.cmd --filter @lyra/api type-check
pnpm.cmd --filter @lyra/api lint
pnpm.cmd --filter @lyra/web type-check
pnpm.cmd --filter @lyra/web lint
```

Before a final handoff or commit, run the full gate:
```bash
pnpm turbo run lint type-check test build
```

---
# Session handoff — continue here

> New session: open this file first (`docs/SESSION-HANDOFF.md`), then say what you want to continue.
> Branch: **dev**.
> ⚠️ **A LARGE amount of work is UNCOMMITTED** — not just the last session. `git status` shows many modified files **and** whole untracked modules/components that the app depends on, e.g. `apps/api/src/{conversations,mail,labels}/`, `apps/web/src/components/{Chats deps, RunFlow, FlowPager, MatrixRain, GoogleButton, ProviderIcon, SaveAsPromptModal, Composer, EditorShell, …}`, `apps/web/src/pages/{Chats,ForgotPassword,ResetPassword}.tsx`, `scripts/`, several docs. Everything **builds + tests green** and the app runs, but none of it is in git history. **Strongly recommend committing before relying on the next session** so this can't be lost. (Per repo rule, commit only when the user asks — but flag this immediately.)

---

## 0. Resume the dev environment (do this first)

Live preview is **dev.getlyras.app** (cloudflared tunnel → Vite). Pieces:
- **web** — Vite dev on `:5173` (HMR; picks up changes automatically). **Mobile via the tunnel does NOT get HMR — do a full page reload there.**
- **api** — `node dist/main.js` from `apps/api` on `:3001` (does **not** auto-reload).
- **mongo** — Docker on `:27017` (`docker compose up -d mongo`).
- **tunnel** — cloudflared → dev.getlyras.app.

**After a backend (apps/api or packages/shared) change you MUST rebuild + restart the api:**
```bash
pnpm --filter @lyra/shared build   # only if packages/shared changed (do it first)
pnpm --filter @lyra/api build
# (PowerShell) kill :3001 then start detached, logs to %TEMP%:
#   Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
#   Start-Process node -ArgumentList "dist/main.js" -WorkingDirectory <repo>\apps\api `
#     -RedirectStandardOutput "$env:TEMP\lyra-api.log" -RedirectStandardError "$env:TEMP\lyra-api.err.log" -WindowStyle Hidden
# verify: Invoke-RestMethod http://localhost:3001/health  -> {status: ok}
```
Web changes need no restart (HMR), but reload mobile fully.

Checks before committing (what CI gates):
`pnpm turbo run type-check lint test build`
e2e: `pnpm --filter @lyra/api test:e2e` (in-memory mongo, hermetic; provider clients stubbed). Currently **all green** (11 e2e suites / 70 tests; unit 28 api + 32 shared + 4 web).

---

## 1. ACTIVE TASK — Pipeline "should work like an image"

The user said *"Our pipeline will work like an image"* and was about to attach a reference image — **it didn't come through.** First thing: **ask them to re-attach the image.**

Before building, pin down which they mean (these differ a lot in effort):
- **Visual restyle** of the existing *linear* flow (boxes + connecting lines, n8n-look) — CSS/layout only.
- **Run-view animation** — flow lights up node→node as it runs (we already light steps up; this is polish).
- **Real DAG** — steps that branch/merge (parallel/conditional). This is a **data-model change**: steps would need explicit edges (`from`/`to`), and the run engine + builder + `RunFlow`/`FlowPager` would all need to handle a graph instead of an array.

Current reality (so you scope correctly): a pipeline is a **linear sequence** of steps. Builder = vertical step list; run = `RunFlow` (desktop) / `FlowPager` (mobile one-step pager) lighting up top→bottom, gates pause for Approve. See `docs/lyra-pipelines.md` and `apps/web/src/components/{RunFlow,FlowPager}.tsx`, `apps/web/src/lib/useRunActions.ts`, `apps/api/src/runs/`.

---

## 2. BLOCKED on the user adding credentials (then restart api)

Both features are **fully built**; they just need real secrets dropped into `apps/api/.env` (gitignored) replacing the placeholders, then an api restart.

**a) Google sign-in (OAuth redirect flow) — needs Google Cloud creds**
- `.env` placeholders to replace: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Google Cloud Console: APIs & Services → Credentials → **OAuth client ID → Web application**. Authorized redirect URI **must** be `https://dev.getlyras.app/auth/google/callback` (add `http://localhost:5173/auth/google/callback` for local). OAuth consent screen in "Testing" is fine; add the tester email as a test user.
- Until set, the Google button just bounces to `/login?error=google_unavailable` (nothing breaks).

**b) Password-reset email (SMTP via Spacemail) — needs the mailbox password**
- `.env` placeholder to replace: `SMTP_PASS` (the `support@getlyras.com` mailbox password). Host/port/user already set (`mail.spacemail.com:465`, SSL).
- Until set, the mailer is a **dev stub** that logs the reset link to `%TEMP%\lyra-api.log` instead of sending.

**Never paste these secrets into chat** — they go in `apps/api/.env` only. After editing `.env`, restart the api (section 0).

---

## 3. What shipped last session (on disk, uncommitted)

**Chats (major) — replaces the old per-prompt testing playground**
- New top-level **Chats** section: Claude-style **multi-turn** chat workbench. Nav order is now **Home · Chats · Prompts · Pipelines · Projects · …**.
- **API:** new `apps/api/src/conversations/` module. New **`Conversation`** collection (per-user, soft-deleted, embedded `messages[]`, each message stamps `provider·model`). Endpoints: `POST /workspaces/:id/conversations` (create empty), `GET /workspaces/:id/conversations` (sidebar list), `GET /conversations/:id`, `POST /conversations/:id/messages` (SSE stream, multi-turn — prior turns sent as context; **every turn auto-persists**), `PATCH`/`DELETE /conversations/:id`. Access = workspace member **and** creator.
- The streaming clients (`anthropic.client.ts`, `openai-compat.client.ts`) gained an optional **`history`** param for multi-turn. History is **text-only**; only the current turn sends attachments.
- **Web:** `apps/web/src/pages/Chats.tsx` (handles `/chats` and `/chats/:id`), `components/ProviderIcon.tsx` (real brand logomarks — Claude/OpenAI/DeepSeek from Simple Icons, white on a brand-colour badge; Image/Video = neutral glyph), `components/SaveAsPromptModal.tsx`.
- **Bridge to the library:** **Save as prompt** on any user message → `SaveAsPromptModal` → `POST /workspaces/:id/prompts` (carries the message's provider·model). **Open in chat** on a library prompt (`Prompts.tsx`) → creates a conversation seeded with that prompt (composer prefilled via nav `state.seed`).
- **Removed:** the `prompt-tests` module, `PromptPlayground.tsx`, the `/prompts/:id/try` route, and the `SavePromptTestDto`/`PromptTest` shared types. Vite proxy `/prompt-tests` → `/conversations`. Cascade soft-delete now covers `Conversation`.
- **Auto-save model:** there is **no manual save tick** in chat — every run is kept; star/keep is via **Save as prompt** into the library. (Supersedes the green-tick design in `docs/lyra-prompt-testing.md`, now marked superseded.)

**Account security**
- Change password (Settings → Password), **forgot/reset via email** (`/forgot-password`, `/reset-password` public pages). `MailerService` (nodemailer, SMTP-or-dev-stub), `PasswordReset` collection (hashed single-use token, TTL). Security-reviewed (forgot-password is fire-and-forget + prior tokens purged to avoid a timing oracle).

**Google sign-in (code complete, see §2)**
- `User.passwordHash` optional + `User.googleId`; password login rejects Google-only accounts. `AuthService.googleConfigured/googleAuthUrl/loginWithGoogle`; `AuthController` `GET /auth/google` + `/auth/google/callback` (CSRF `g_state` cookie). `GoogleButton.tsx` on Login + Signup. White **matrix-rain** background on the auth pages (`MatrixRain.tsx`).

**Prompt editor fixes** (`PromptEditor.tsx`)
- Header actions reordered to **✓ save then ✕ cancel**. Added an **unsaved-changes guard** (`useBlocker` + `beforeunload`) with a "Save changes?" dialog.

---

## 4. Chats — architecture notes & gotchas (for whoever continues)

- **First-send flow (important):** new chats are **lazy-created** on first send. The reply **streams while still on `/chats`**, then we `navigate('/chats/:id', {replace})` **after** it finishes (a `skipLoadRef` stops the load-effect from re-fetching). This ordering avoids a mid-stream navigation race that previously blanked the thread. If a send fails **before streaming** (e.g. the chosen provider has no key), the just-created empty conversation is **deleted** so it doesn't litter history. Don't reintroduce navigate-before-stream.
- **Provider keys still gate sends** (BYOK, per-workspace, encrypted). Sending with a model whose provider has no key → 400 from `prepareRun` → error shown on the assistant bubble (and, for a brand-new chat, the empty convo is cleaned up).
- **Chats are private to their creator.** Teams share via **public prompts** in the library, not via chats.
- **Known leftover:** any **empty chats** created before the fix above will still show blank when opened — delete them via the trash on hover in the sidebar.
- `AppNavContext` (in `apps/web/src/layout/breadcrumb.ts`) lets the full-bleed chat open the app nav drawer; the chat's mobile top-left button is the **Lyra mark** (`/lyra-mark-squircle.svg`) and opens that menu (the app hides its top bar for `.chat` on mobile).

---

## 5. Other open follow-ups
- **Old `docs/SESSION-HANDOFF.md` Figma/Linear audit** is still pending — see git history (`d67f584`) for the full plan if you want to resume it. Short version: enable the Figma desktop MCP server *before* starting the session, then audit Lyra's tokens/components against the Linear community file (keep the orange `#FF6B1A` accent).
- **Secret hygiene:** the tester Gmail/SMTP passwords must be **rotated** and never committed; keep all secrets in `apps/api/.env`.
- **Bundle size:** web JS ~585 KB (gzip ~178 KB). Optional: lazy-load `Markdown.tsx` / the chat route.
- **Providers:** only **Anthropic** + **OpenAI/DeepSeek** (OpenAI-compatible) execute for real; image/video are still mocks.

## 6. Source-of-truth docs
`CLAUDE.md` (root, current-state paragraph is up to date incl. Chats) · `docs/lyra-pipelines.md` (composable pipelines / business model v2) · `docs/lyra-requirements.md` · `docs/lyra-hosting-cicd.md` · `docs/lyra-design-system.md` (its dark tokens are superseded by the light/Linear `index.css`) · `docs/lyra-prompt-testing.md` (**superseded** by Chats — historical only).
