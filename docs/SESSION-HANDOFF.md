# Session handoff — June 20, 2026 — Crawler downloads working: JS-challenge fix (yt-dlp nightly + Deno) · quality selection · live progress bar · TikTok retry

> **Read this first.** Branch **dev** is **PUSHED** to `origin/dev` through **`6907847`**. Work in worktree **`.claude/worktrees/notification-bell`** (branch `feat/members-page`; HEAD == origin/dev). Gate green every commit: `pnpm turbo run type-check lint test build` (16/16; connectors-service **62**, api **121**, web ~41, shared ~50). **Commit/push only when the user asks** (they asked for both commits this session). Tracked also in `[[crawler-pending-work]]` memory.

## ✅ Shipped this session (origin/dev)
- **JS-challenge YouTube downloads now work** — the open task from the prior entry. Updated **yt-dlp → nightly `2026.06.18`** (`--update-to nightly`) and put **Deno 2.8.3** on PATH (already winget-installed at `…\DenoLand.Deno_…\deno.exe`). yt-dlp's `[jsc:deno]` solver now passes YouTube's nsig challenge. **Environment-level fix** (no code except the timeout bump below). Verified: a previously-"not available" video resolves + fully downloads.
- **`fa5f645` Crawler quality selection + live download progress.** Resolve surfaces a per-item **quality menu** (1080p…240p + audio, size hints) from yt-dlp's format list (`qualitiesFromFormats`); download passes the chosen **`-f`** selector, defaulting to **≤720p** (keeps files small → also dodges the timeout). Downloads now run as an **async job** (`DownloadJobStore`, `POST /download`→`{jobId}`, `GET /download-jobs/:id`) the web **polls every 0.8 s**, rendering a native **`<progress>` bar**; replaces the old blocking call + spinner. Bumped the yt-dlp spawn timeout **120 s→600 s** so large/long videos finish. Shared: `MediaQuality`, `MediaItem.qualities`, `DownloadJob`, `DownloadDto.format`. en+vi i18n.
- **`6907847` TikTok transient-retry.** TikTok intermittently serves a page missing the rehydration blob (~50% on the **same** link → scary "report this issue" error). `runYtDlpRetrying` re-invokes yt-dlp up to **4× with a 0.5 s backoff**, but **only on transient reasons** (`isTransient`: rehydration / "Unable to extract" / 5xx / timeouts); permanent reasons (unavailable/private/sign-in) fail fast. Wired into resolve + download. Verified **3/6 → 6/6**.

## ⚠️ Environment state the next session needs
- **dev.getlyras.app = the local machine** (tunnel to `:5173/:3001/:9100`). **No cloud deploy** (no `.github/workflows`, no deploy script) — pushing to dev triggers nothing; "deploy" = the running local servers.
- **All three servers run from the WORKTREE** (this session repointed them off the main tree, per the user): web `:5173` (vite HMR), api `:3001` (built dist), connectors `:9100` (built dist + Deno). They are **detached `Start-Process` node procs** — **won't survive a reboot**; PIDs change. yt-dlp/ffmpeg/deno are **NOT on the default PATH** (winget dirs in the prior entry below; deno dir `…\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe`). **:9100 restart recipe:** stop the `:9100` listener; set `$env:PORT=9100; CONNECTORS_SERVICE_TOKEN=e2e-test-token-local; POSTIZ_API_URL=http://localhost:5000/api; POSTIZ_PUBLIC_URL=http://localhost:5000`; prepend yt-dlp+ffmpeg+deno dirs to PATH; `Start-Process node dist/main.js -WorkingDirectory <worktree>/apps/connectors-service`. **⚠️ Don't set `$env:PORT=9100` before starting the api** — it inherits it and crashes (bind 3001).
- Worktree `apps/api/.env` was **copied from the main tree** (gitignored). Service log files (`*-9100/3001/5173.*.log`) are gitignored.

## 🔜 Pending — "we'll do tomorrow" (user) — RESEARCHED + PLANNED overnight
Overnight (autonomous, user said "follow your recommendation, I'll check tmr") I
researched 9router and wrote docs/plans for everything below. **No code shipped** —
the 9router finding is "don't adopt" (would break invariant 7), and the other tasks
the user asked me to *plan*, not build. Read the docs, then greenlight.
1. **9router — EVALUATED → DO NOT adopt for the product.** Decisive: its inbound API
   key is a *gate, not a tenant selector*; provider accounts are chosen by global
   routing; single-user; keys in its own SQLite via dashboard/OAuth → head-on conflict
   with invariant 7 (per-workspace encrypted BYO keys). Full writeup +
   citations: **[superpowers/specs/2026-06-20-9router-evaluation.md](superpowers/specs/2026-06-20-9router-evaluation.md)**.
   Use it *personally* for Claude Code token savings (no Lyra code). The value it sells
   (multi-provider + fallback) → build in Lyra's own `ProviderRegistry`:
   **[superpowers/plans/2026-06-20-multi-provider-fallback.md](superpowers/plans/2026-06-20-multi-provider-fallback.md)**
   (note: CLAUDE.md is stale — OpenAI/DeepSeek/Image are already *real*, only Video/Crawl mock).
2. **Durability + crawler polish + cookies + git gc** — all planned in
   **[superpowers/plans/2026-06-20-crawler-ops-pending.md](superpowers/plans/2026-06-20-crawler-ops-pending.md)**:
   sync `codex-dev` to origin/dev + run servers from the main tree + a process manager
   (survive reboot); Dockerfile **Deno + nightly yt-dlp**; per-workspace encrypted
   **cookies.txt** for logged-in/age-gated videos (security-gated); **smooth the % bar**
   via a file-count heuristic (`Downloading N format(s): 399+251` → N files); `git gc`.

## ⏸️ Still deferred (don't start unless asked)
- Permission-normalization (canEditOwned / Owner override on prompts — spec approved, unbuilt). Members increment 3 (**Viewer** role). Postiz publish-v2 live e2e (needs the user to connect a channel). See `[[members-area-roadmap]]`, `[[per-project-channels-model]]`.

---

# Session handoff — June 19, 2026 (late) — Members area (bell + page) shipped · "Crawler" rename · Crawler debug (yt-dlp/ffmpeg installed; JS-challenge/deno still pending)

> **Read this first.** Branch **dev** is **PUSHED** to `origin/dev` through **`f8abebf`**. All work below is on dev + **deployed** to dev.getlyras.app (local `pnpm dev` HMR off the main tree). A parallel **Codex agent** shares this tree (it did a big i18n pass this session); reconcile via `git merge origin/dev` — it builds on top of pushed commits, so merges have been **clean** (see `[[concurrent-codex-claude-tree]]`). Gate green every commit: `pnpm turbo run type-check lint test build` (16/16; web 41, api ~110, connectors-service 49, shared 50). Work done in worktree **`.claude/worktrees/notification-bell`** on branch **`feat/members-page`**. **Commit/push only when the user asks** (this session the user asked repeatedly).

## ✅ Shipped this session (all on origin/dev `f8abebf`, deployed)
- **Dead-code cleanup** — removed the unused `conversations/prompt-history-list` route + `listForPrompt`, and orphaned `chats.*` i18n keys.
- **Prompt-access guard spec** (`apps/api/src/prompts/guards/prompt-access.guard.spec.ts`, 6 cases) + **permission-normalization design spec** (`docs/superpowers/specs/2026-06-19-resource-edit-permission-normalization-design.md` — `canEditOwned` + workspace-Owner edit/delete override on prompts; **APPROVED, NOT BUILT**). See `[[prompt-permissions-creator-only]]`.
- **Notification bell** (Members-area increment 1) — built subagent-driven (plan: `docs/superpowers/plans/2026-06-19-notification-bell.md`). Shared `MyInvite` + `'declined'` invite status; api `GET /invites/mine`, `POST /invites/:id/accept|decline` (authorized by **email match** — `invite.email === user.email`, since the email-link token isn't available in-app); `materialize` DRY'd; `useInvites` hook; `NotificationBell` in `topbar-actions`. **Dep-free** (no RTL/jsdom — see `[[web-tests-no-rtl]]`).
- **Members page** (increment 2) — `apps/web/src/pages/Members.tsx` (+ `members.css`), route `/members`, nav item enabled (SOON stub dropped). Card gallery; owner invites (email + Owner/Member role → copyable accept link, no mailer) / changes role / removes / revokes pending invites. `.lin-toolbar` (search + role filter + `+` invite). **Team-only**: nav link gated on `current?.type === 'team'`, page redirects home on a personal workspace (api endpoints already existed). See `[[members-area-roadmap]]`.
- **Workspace type icon** — `PersonIcon` added; `WorkspaceMenu` shows name **+** team/personal icon (`MembersIcon`/`PersonIcon`).
- **"Import media" → "Crawler"** rename (nav/home/connectors i18n, en+vi).
- Reconciled cleanly with **Codex's i18n refactor** (`a63c009`) → merge `35452aa`.

## 🐞 Crawler (Built-ins → media download) — debugged, PARTIALLY fixed
The page is `apps/web/src/pages/ImportMedia.tsx` → Lyra api proxy (`apps/api/src/connectors/connectors.proxy.ts`, `CONNECTORS_SERVICE_URL=http://localhost:9100`) → **`apps/connectors-service`** (NestJS :9100) which spawns **yt-dlp** (+ ffmpeg).
- **Root cause of "Fetch does nothing":** yt-dlp + ffmpeg were **not installed** → service 500. **FIXED:** installed `yt-dlp` 2026.06.09 + `ffmpeg` 8.1.1 via **winget**. Popular videos now resolve.
- **Error-surfacing FIX (`f8abebf`):** connectors-service `download.controller.ts` now wraps yt-dlp errors → `UnprocessableEntity(422)` with the parsed reason via `ytDlpReason()` (`ytdlp.ts`); Lyra's proxy forwards 4xx messages, so the UI shows e.g. *"This video is not available"* instead of a generic 500. Verified (422).
- **⏭️ STILL OPEN — the user's priority:** some public videos (e.g. `sYeY8f0hHxI`, `ATOB4EE8SfU`) report *"This video is not available"* — **NOT truly unavailable**. Proven by **ytdlp.online** downloading the exact video with **yt-dlp 2026.06.18** + **`[jsc:deno]`**. YouTube now gates them behind **JS challenges (nsig)** that need a **JS runtime**. Mine (2026.06.09 + bundled `yt_dlp_ejs`) fails the challenge. **NEXT:** `yt-dlp --update-to nightly` (or reinstall ≥2026.06.18) **+ install `deno`** (`winget install DenoLand.Deno`) → restart :9100 with deno on PATH → retest `sYeY8f0hHxI`. Optional follow-up: yt-dlp cookie support (`--cookies-from-browser`) for the user's own logged-in/region videos (region locks are IP-based — only a proxy fixes those).

## ⚠️ Environment state the new session needs
- **yt-dlp/ffmpeg are NOT on the harness shells' default PATH** (winget updated the registry PATH, but harness-spawned shells inherit a stale PATH). Use full paths or prepend:
  - yt-dlp dir: `C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe`
  - ffmpeg dir: `C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin`
- **`:9100` connectors-service is currently running from the WORKTREE dist** (the error-surfacing fix), PID may change. Restart recipe (PowerShell): stop the `:9100` listener, set `$env:PORT=9100; $env:CONNECTORS_SERVICE_TOKEN="e2e-test-token-local"; $env:POSTIZ_API_URL="http://localhost:5000/api"; $env:POSTIZ_PUBLIC_URL="http://localhost:5000"`, prepend the yt-dlp+ffmpeg(+deno) dirs to `$env:PATH`, then `Start-Process node -ArgumentList "dist/main.js" -WorkingDirectory "<connectors-service dir>" -RedirectStandardOutput/Error <log>`. **Durability:** once it works, rebuild the **main-tree** `apps/connectors-service` and run :9100 from there (not the worktree), and add `deno` to its Dockerfile (which already bundles yt-dlp+ffmpeg).
- Running: api `:3001` (REAL mode), web `:5173`, mongo + postiz (docker). dev.getlyras.app = main-tree HMR; api is `nest --watch` (auto-restarts on code change). `apps/api/.env` has `CONNECTORS_SERVICE_URL=http://localhost:9100` (UNCOMMITTED; comment out → mock mode).
- git: `git gc` would clear a "too many unreachable loose objects" warning when convenient.

## ⏸️ Other pending (not started)
- Permission-normalization (canEditOwned / Owner override on prompts) — spec approved, **unbuilt**.
- Members-area increment 3 — **Viewer** role (enum + `canCreate` gating + role picker). See `[[members-area-roadmap]]`.

---

# Session handoff — June 19, 2026 (night) — card galleries everywhere · CSS tokenized · Chat-as-assistant (Prompt owns saved answers) · landing/auth/admin dark-mode fixes

> **Read this first.** Branch **dev** is **PUSHED** to `origin/dev` through **`fb387e2`** (all 16 commits below are up). Working tree clean except three **intentionally-untracked** paths: `data/` (the prompts.chat rich export), `import-rich.cjs` (re-runnable marketplace importer), and `.codex-dev/` (a parallel **Codex agent's git worktree** — not our tree; ignore it, but see `[[concurrent-codex-claude-tree]]`). **Commit/push only when the user asks.** Web gate stayed green every commit: `pnpm turbo run type-check lint test build` (web ~38 tests; api 103 tests).

## ✅ Shipped this session (all on origin/dev)

**Card galleries everywhere (the requested redesign).**
- `f0010d0` **Prompts / Pipelines / Projects → read-only `.lib-card` galleries** on a shared `.lib-grid`/`.lib-card` shell in `layout.css` (matches the Marketplace). Cards are pure read views — **all inline edit removed** (rename, status toggle, tag `LabelPicker`, the Projects name/description fields); editing happens in the dedicated editors.
- `fb387e2` **Admin → Users** is now the same card gallery (avatar · name · email · meta · status badge — **no label:value rows**) + search; **removed the redundant "Admin / Platform operations" top header**; clicking a card **drills into a full user detail view** (back button + identity header + workspaces + usage + deactivate), replacing the old inline expand. `apps/web/src/pages/{Admin.tsx,admin.css}`.

**CSS + code hygiene.**
- `fd4e5f3` **tokenized hardcoded CSS colors** in `layout.css` + `connectors.css` — new tokens `--on-accent`, `--danger-tint`/`--danger-wash` (with dark values), `--code-bg`/`--code-ink`/`--code-ink-muted`; deleted dead `.project-card.vis-*` side-stripes; made `.badge.vis-private` theme-adaptive. Only genuinely-bespoke literals remain (brand gradient, platform brand colors, two contrast-tuned inks, media letterbox black), each commented.
- `8d7de87` **DRY: shared helpers** — `src/lib/{format.ts (fmtDate/initial/initials/avatarStyle), useOutsideClick.ts, constants.ts (PROVIDER_LABELS/STATUS_COLOR), array.ts (toggleInList)}` replace ~14 copy-pasted definitions; deleted dead `pipelineNamePatch`. Net −205 lines.

**Chat → AI assistant + Prompt owns saved answers** (the big feature — see the spec).
- `f07da1d` **Chats left the nav → a bottom-right "AI" FAB** (opens `/chats` over the current page); sidebar reordered to **Home · Marketplace · [Workspace group: Prompts/Pipelines/Projects] · Built-ins**; `WorkspaceMenu` moved under a "Workspace" group label.
- `f59e7c5` **design spec** → `docs/superpowers/specs/2026-06-19-chat-as-assistant-design.md` (read it — §12 boundary, §13 as-built).
- `6a22800` **api: Prompt owns `results[]`** (saved answer-children). Shared `SavedResult` + `Prompt.results`; subdoc schema; service `addResult`/`removeResult`/`updateResult`; routes `POST|PATCH|DELETE /prompts/:id/results[/:resultId]` (reuse `PromptAccessGuard`; **add = any prompt-viewer**, **remove/update = result author or prompt owner**). 7 new unit tests.
- `d7b0a89` **web:** Prompt details' conversation-history timeline → **`SavedResults`** list (`PromptHistory` deleted); each AI answer in chat gets a **Save** action (only when the chat has a parent prompt); **Save as prompt** links the chat + attaches the triggering answer as the first result; a desktop **results rail** beside the thread. Retired the auto-save toggle + "Save to history".
- `cd67817` consistent disabled state for the chat save pills (no more dead disabled button on every answer). `8569a60` **close (X) button** on the chat header (returns to origin or home).

**Landing / auth / home dark-mode + content.**
- `a155cd7` **landing dark-mode contrast** — three frosted surfaces (`.l-campaign` card, `.l-glimpse-card`, `.l-publish-pill`) were hardcoded **white** `rgba(255,255,255,…)` and never flipped → light-on-light (the white-on-white channel pills + faded "Publishing to" chips). Added `--l-glass`/`--l-glass-strong`/`--l-glass-line` tokens that flip; lifted `--l-ink-subtle` to clear AA on warm dark surfaces.
- `cb9cc1e` **auth pages get a theme + language toggle** — new `components/AuthTopBar.tsx` (shared `PrefControls`) top-right on login/signup/forgot/reset. (The auth CSS already flipped with `data-theme`; the gap was no control on those pages for direct arrivals.)
- `c75355c` refreshed in-app **home copy** (Chats = the assistant; dropped the false "every turn auto-saved"). `005a47c` added **Marketplace + Import (crawl public) + Publish (multi-channel)** tiles to the home hub (+ `--accent-marketplace`/`--accent-import`/`--accent-publish`).
- `2baefd8` marketplace **adopt confirmation** (ConfirmDialog before copying a catalog prompt into the library).

## 📐 Key decisions (so the next session doesn't re-litigate)
- **Prompt is the durable parent; each saved answer is a child** (`results[]`). v1 = flat prompt + per-answer `promptSnapshot` (no version objects). Chat threads are disposable scratch; only deliberately-saved answers are children.
- **Three isolated lanes, no bridge in v1:** chat (prompt→results), pipeline (reusable template, never reads results), project (project+pipeline→Runs, fresh per assignment, never crosses projects). Pipelines/projects are **unaffected** by `results[]`. (Spec §12.)
- **Coolify** (coolify.io) was reviewed for hosting: a good fit for the "VPS + Docker Compose" path (api+worker+redis+web on one box, git auto-deploy, SSL); recommend keeping **Mongo on Atlas** (transactions/replica-set) + **assets on R2**. Advisory only — nothing built.

## 🔜 Deferred / cleanup (not blocking)
- **Saved-answer rating UI** (backend stores `rating`/`note`; no UI yet).
- **Dead-code cleanup:** the `conversations/prompt-history-list` endpoint + unused `chats.*` i18n keys (`autoSave`, `saveToHistory*`, `couldNotSave`) are now orphaned (spec §8/§13).
- **Admin Users status filter** (Active/Inactive) — needs an api query param; search-only for now.
- **Context-aware assistant**, **in-chat thread switcher**, marketplace catalog made durable (`[[marketplace-category-import-plan]]`).

## ⏸️ Still paused (unchanged)
- Postiz publish-v2 live-post e2e; per-project channels (`[[per-project-channels-model]]`). Autonomous loop + Connector Scout still deferred (`[[phase4-autonomous-loop-deferred]]`, `[[connector-scout-deferred]]`).

---

# Session handoff — June 19, 2026 (evening) — Prompt-library UX + Marketplace rebuilt (prompts.chat-style) + Chats auto-save

> **Read this first.** Branch **dev** is **PUSHED** to `origin/dev` through `fc0d24c`. Tree clean except the intentional `docker-compose.yml` pin (keep uncommitted), gitignored `apps/api/.env`, and **untracked `data/`** (the prompts.chat rich export + `import-rich.cjs`). Commit/push only when the user asks.

## ✅ Shipped this session (all on origin/dev; web gate green each commit: type-check, lint, ~39 tests, build)

**Landing** — `402992f` real generated section images (local WebP, `apps/web/public/landing`); `b3ecb44` dark-mode nav color + edge padding (token-driven `color-mix` bg).

**Marketplace → prompts.chat-style card gallery** (`apps/web/src/pages/Marketplace.tsx` + `marketplace.css`, `components/{MarketplaceDetails,PromptCodeBlock}.tsx`, `apps/api/src/marketplace/*`)
- `a3ff954` replaced the Linear rows with a **card gallery**: card = title · type badge · monospace **code-block** (clamped 4 lines) · colored tag chips · footer (Copy / Open-in-chat / View / Add). `d307c7a` colored tag chips; `3014938` readable contributor.
- `8bc863b`/`82a80d7` shared **`PromptCodeBlock`** (monospace block under a header bar: label + Copy + optional Open-in-chat) — reused by the marketplace AND the library prompt detail.
- `2bb0403` **`category` + `description`** added to `MarketplacePrompt` (shared model + api schema + `marketplace.views`) and shown on the card (category pill + 2-line desc) + detail.
- `3c6afed` **Type / Category / Tags filter popover** (mirrors the Prompts filter) + `GET /workspaces/:id/marketplace/facets` (distinct categories+tags) + list filters via repeated `?type=`/`?category=`/`?tag=`. `MarketplaceFacets` in shared. Dropped the "For developers" toggle.
- `fc0d24c` removed the AI **hero**; the toolbar is now **Search · ✨AI · + Filter** — the `✨AI` button (new `SparkleIcon`, brand-orange) AI-ranks the search-box text.
- **Catalog data lives in the dev DB, NOT git.** `marketplaceprompts` holds a curated **~138 dropshipping-only** set imported from the rich export `data/prompts_2026-06-19.csv` (native `category_name`/`tags`/`description`) via `import-rich.cjs` (untracked, re-runnable). Curation = drop IT/edu/off-domain by category + NSFW, require a commerce+no-IT signal for ambiguous categories (Image/Video Gen, Creative, Business, none). ⚠️ **Do NOT run the admin "Catalog sync"** — it re-pulls the live OLD-format `prompts.csv` (no category/desc) and would overwrite this. See `[[marketplace-category-import-plan]]`.

**Prompt library** (`apps/web/src/pages/{Prompts,PromptEditor}.tsx`, `components/{PromptDetails,PromptHistory,TypeSelect}.tsx`)
- `d575d16`/`220b0d8` **`type`** on Prompt — shared `PromptType` (text/image/audio/video), api schema/DTO/filter. Metadata only (badge + filter); the editor picks it via a **`TypeSelect`** icon+text dropdown (colored glyphs, `lib/promptType.tsx`). (A `category` field was added in `e874d82` then **removed** in `220b0d8` — tags cover it.)
- `e874d82` colored type icons + an **Open-in-chat** "Try" button in the editor; `101ea7c` decluttered the editor header (flat ✓/✕, Type+Status on one row, dropped the "Status" label).
- `c956619` **`PromptDetails` is now a read view** (marketplace-style): the prompt in a `PromptCodeBlock` (Copy + Open-in-chat), meta = creator · date · provider·model · **status pill** · **type badge**, colored tag chips, parsed `{variable}` chips. **Inline-edit removed** (edit via the full editor). Below it, **`PromptHistory`** — a vertical run-history timeline of every chat opened from this prompt, via `POST /workspaces/:id/conversations/prompt-history-list` (`listForPrompt`). Fixed the `prompts.type.undefined` badge (defaults to text).

**Chats** (`apps/web/src/pages/Chats.tsx`, `apps/api/src/conversations/*`)
- `5ad096f` the two header buttons are replaced by an **Auto-save** switch + a **Save to history** button. Auto-save ON → a chat opened from a library prompt links to that prompt's history on creation (`originPromptId`). OFF → the chat still saves as a normal chat but only links to the prompt's history when the user clicks **Save to history** (PATCH `originPromptId`; `UpdateConversationDto` now accepts it; pending source stashed per-session for reload). The chat **composer border is now Lyra-orange**.

## 🔜 Next (requested, NOT started)
- **Prompts / Pipelines / Projects pages → card galleries** like the marketplace (replace the `.ptable`/`.prow` list rows with `.mkt-grid`/`.mkt-card`-style cards). This handoff was written as the prerequisite doc-update before that redesign.

## ⏸️ Still paused (unchanged)
- Postiz publish-v2 live-post e2e; per-project channels (`[[per-project-channels-model]]`).

---

# Session handoff — June 19, 2026 (latest) — design-consistency pass shipped + design plugins enabled

> **Read this first.** Branch **dev** is now **PUSHED** to `origin/dev` (user asked) — through commit `da4e071`. Working tree clean except the intentional **`docker-compose.yml`** Postiz `v2.11.3` pin (keep uncommitted) and gitignored `apps/api/.env`. Commit/push policy still: only when the user asks.

## ✅ Shipped this session (design-system consistency, all on origin/dev)
A token-enforcement + UX pass on `apps/web`. Each commit kept the web gate green (type-check, lint, 38 tests, build). All live on dev.getlyras.app via the running Vite HMR.
- `b47c782` tokenize status/section-accent colors (+dark-mode badge fix)
- `22473ad` **Home "Get started" onboarding checklist** (the #1 UX-audit gap) — `apps/web/src/lib/gettingStarted.ts` (unit-tested) + `pages/Home.tsx` + `.gs-*` CSS
- `ed559e5` Settings per-provider "Get a key ↗" links
- `d01ae94` consistent list-row typography (Projects vs Prompts/Pipelines mismatch on mobile — `.prow-title-input/.prow-desc-input` pinned; `--text-mini/--text-micro` tokens)
- `3cb7eac` **consistent action affordances** (delete=X everywhere incl. Settings; modal close=X; row icons neutral+token) + tokenized action/semantic colors (+`--info`)
- `a68321b` **shared `<EmptyState>` + `<IconButton>` primitives** + `docs/lyra-design-system-actions.md` (the enforceable rules)
- `da4e071` **high-contrast form placeholders** via one `--placeholder` token (was `--ink-tertiary` 0.3 ≈ unreadable)

**Source-of-truth design docs:** `docs/lyra-design-system-actions.md` (action/token/reuse rules), `docs/lyra-linear-audit.md` (Linear spec from Figma), `docs/superpowers/specs/2026-06-19-lyra-ux-redesign-plan.md` (recon + roadmap). The live token layer is `apps/web/src/index.css :root` (+ `[data-theme=dark]`); `apps/web/CLAUDE.md` UI section was corrected (the dark `lyra-design-system.md` is SUPERSEDED).

## ⏳ Remaining design-consistency queue (not done — do carefully)
1. Migrate the grid-coupled `.prow-*` row buttons through `<IconButton>` — needs a **mobile visual check** (grid-area coupling), don't blind-edit.
2. Build `<Modal>` + `<InlineEdit>` shared primitives (10 dialogs re-roll backdrop/escape; 3 inline-edit classes `.prow-edit`/`.lin-title-input`/`.prow-title-input` do the same job).
3. Long-tail token sweep (~400 off-scale font-size/radius/spacing values → tokens). Some are intentional — needs care + the user's eyes, NOT a mass find-replace.

## 🔌 Design/coding plugins — ENABLED, pending restart
`~/.claude/settings.json` `enabledPlugins` now has **impeccable@impeccable, taste-skill@taste-skill, headroom@headroom-marketplace, ponytail@ponytail** (marketplaces all registered in `extraKnownMarketplaces`). They load on the **next Claude Code restart** (the startup reconciler caches them from the local marketplace clones). `/plugin` is unavailable in this VS Code extension build (stale — updating it would restore `/plugin`); we enabled via settings.json instead.
- **impeccable** (`/impeccable polish|audit|critique`) + **taste-skill** — frontend design audit/taste skills. Use them to second-opinion the consistency work.
- **ponytail** (`/ponytail-review|-audit|-debt`) — "write less code" reuse-first ruleset; well-aligned with this codebase. Consider `lite` mode.
- **headroom** — context-compression HOOKS; ⚠️ behavior-altering AND **non-functional until** `pip install "headroom-ai[all]"` (Rust build; not yet installed).
- After restart: verify each appears in `~/.claude/plugins/installed_plugins.json` + `cache/`, then they're invokable.

## ⏸️ Still paused (unchanged, see older sections below)
- **Postiz publish v2 live-post e2e (Steps 4–5)** — services left running; tester `tholv.7990@gmail.com`, workspace `6a309b8efe9ec7c83515dad5`.
- **Per-project channels model** — build after the e2e (see [[per-project-channels-model]]).

---

# Session handoff — June 19, 2026 (overnight) — 🎨 UX redesign pass started

> **You said "redesign to follow Linear + make it simple to use" then went to
> sleep ("follow your recommendation, no need to ask").** I did the part that
> needs neither the gated plugins nor Figma. The **e2e is still PAUSED** (your
> call — services left running, resume map below). **Branch `dev`: 4 new
> unpushed commits on top of the publish-v2 work. Nothing pushed.**

## ▶ What shipped overnight (4 commits — full plan: docs/superpowers/specs/2026-06-19-lyra-ux-redesign-plan.md)
- `b47c782` **token consistency** — `--warning` + `--accent-*` tokens; run dots /
  flow borders / "done" badge now read `--success`/`--warning`; deduped the 3
  `STATUS_COLOR` maps; Home tile accents tokenized. **Fixes a dark-mode bug**
  (draft/public badge text was too dark on dark).
- `22473ad` **Home "Get started" onboarding** (headline) — dismissible checklist
  above the hub: keys → prompt → pipeline → project (the order *is* the mental
  model). Progress bar, done-checks, primary CTA on the first incomplete step.
  Pure logic unit-tested. **This is the #1 UX-audit gap, now closed.**
- `ed559e5` **Settings "Get a key ↗" links** — deep-links to each provider's key
  console; completes onboarding step 1.
- docs commit — UX-redesign plan + fixed the stale `apps/web/CLAUDE.md` (it still
  pointed at the superseded dark design doc).

Web gate green every commit (`type-check`, `lint`, **38 tests**, `build`). The
`:5173` dev server HMR'd it live → **dev.getlyras.app already shows the new Home
onboarding**. Toggle dark mode to see the badge-contrast fix.

## ▶ To finish the redesign the way you asked (needs YOU)
1. Install the design skills (I can't run `/plugin`): `taste-skill` + `impeccable`
   (commands below in "3 Claude plugins").
2. Connect a **Figma MCP** (or hand me Linear refs). Bridge already exists:
   `scripts/figma-mcp.sh`. Then I run the full per-screen pass, Figma-validated.
3. Decide two product-naming calls I left alone: rename "Chats"? disambiguate the
   "Draft/Public" labels? (See the plan doc.)

---

# Session handoff — June 19, 2026 (⏸️ E2E ON HOLD — resume here)

> **Postiz publish v2 is BUILT, reviewed, gated, and API-verified. Only the live-post e2e is paused mid-way.** Branch **dev**: **11 unpushed commits** (`135408a..4169442`, publish v2 + docs), local only — **nothing pushed**. Commit/push only when the user asks. Never paste secrets in chat.

## ▶ What "keep going" means now: finish the publish v2 live-post e2e
Build is done (see "Publish v2" below). The **live Bluesky post** is the last unverified step.

**Environment is left RUNNING (resume instantly):**
- **Postiz** `:5000` — self-hosted, **pinned `v2.11.3`** in `docker-compose.yml` (UNCOMMITTED edit; `:latest`=v2.12+ hard-requires a Temporal server the template lacks → backend crashes on `TemporalRegister.onModuleInit` `ECONNREFUSED ::1:7233`). Public API base = **`http://localhost:5000/api`** (→ `/api/public/v1/...`).
- **connectors-service** — run **locally** (not docker): `PORT=9100 CONNECTORS_SERVICE_TOKEN=e2e-test-token-local POSTIZ_API_URL=http://localhost:5000/api POSTIZ_PUBLIC_URL=http://localhost:5000 node apps/connectors-service/dist/main.js`.
- **Lyra api** `:3001` — **REAL mode**: `apps/api/.env` got `CONNECTORS_SERVICE_URL=http://localhost:9100` + `CONNECTORS_SERVICE_TOKEN=e2e-test-token-local` (UNCOMMITTED; comment out to restore mock mode). Web `:5173` + mongo up.
- ✅ **Verified Steps 1–3:** Postiz public API works (401 w/o key), connectors-service↔Postiz wired + guards pass, api real-mode key-gating confirmed (`GET channels` no-key → friendly 400). **Finding (follow-up):** connectors-service surfaces a bad Postiz key as a generic **500** (should be a clean 4xx); upstream body is NOT leaked.

**▶ Remaining (Steps 4–5, needs the user):** create Postiz admin at `localhost:5000/auth` (LOCAL account, not postiz.com) → connect a **Bluesky** channel (handle + app-password) → copy **Settings → Public API** key → paste in **Lyra → Connections** (browser, not chat) → then publish: `GET credentials`→connected, `GET channels`→real Bluesky channel, `POST publish`→capture live post URL. Tester login: `tholv.7990@gmail.com` (⚠️ user pasted pw in chat — **remind them to rotate**), workspace `6a309b8efe9ec7c83515dad5`.

## Open threads to raise tomorrow
- **Per-project channels (design decision):** user wants social channels scoped to **projects**, not workspace. Agreed model: **connect once = workspace "account pool"; each project selects its subset** (`project.channels`); project-scoped publish; dovetails with the deferred publish-as-pipeline-step. Brainstorm + build AFTER the e2e. See [[per-project-channels-model]].
- **3 Claude plugins to install (user wants these — vetted real + benign):** "taste-skill" and "impeccable" were NOT compliments — they're real repos. All three are `.claude-plugin` marketplaces; install is **USER-typed `/plugin` slash commands** (I can't run them; it's the path-safe, conflict-free method — a manual file-copy half-breaks impeccable's `node .claude/skills/impeccable/scripts/*.mjs` relative paths). Commands:
    - **impeccable** (pbakaus, frontend design/audit skill, Apache-2.0): `/plugin marketplace add pbakaus/impeccable` → `/plugin install impeccable@impeccable`
    - **taste-skill** (leonxlnx, "anti-slop frontend" design skills): `/plugin marketplace add leonxlnx/taste-skill` → `/plugin install taste-skill@taste-skill`
    - **headroom** (chopratejas, context-compression *startup hooks* — changes Claude Code's context handling; likely needs `pip install "headroom-ai[all]"`, python3.13/pip present): `/plugin marketplace add chopratejas/headroom` → `/plugin install headroom@headroom-marketplace`. ⚠️ behavior-altering — install with the user present.

## Publish v2 (DONE — the 11 commits)
connectors-service `publish/` module (Postiz client+mappers, JobStore, PublishService partial-failure, controller) → shared `ConnectorCredentialInfo` → api encrypted per-workspace `ConnectorCredential` store + real credentials routes + `X-Connector-Key` forwarding → web Connections (real key state + "Manage in Postiz") → compose wiring. Spec/plan: `docs/superpowers/{specs,plans}/2026-06-18-connectors-microservice-publish*.md`. Gate GREEN 16/16. Final review: general=READY; **security review found 2 Important (SSRF on media fetch + Postiz error-leak) → FIXED (`safeFetch` + sanitized errors) → re-review SECURE TO MERGE**.

---

# Session handoff — June 18, 2026

> Open this file first in the next session. Branch: **dev**.
> **State:** working tree is **clean**. `dev` has **12 unpushed commits** (connectors download-v1, below) — local only, **nothing pushed**. Commit policy: **commit/push only when the user asks**. Never paste secrets in chat (`apps/api/.env` only).

## Most recent session — Connectors microservice **download v1** (yt-dlp) ✅ DONE

Built **subagent-driven** (plan: [docs/superpowers/plans/2026-06-18-connectors-microservice-download.md](superpowers/plans/2026-06-18-connectors-microservice-download.md); spec: [docs/superpowers/specs/2026-06-18-connectors-microservice-download-design.md](superpowers/specs/2026-06-18-connectors-microservice-download-design.md)). Whole-branch review (opus) = **READY TO MERGE**, 0 critical/important. Full gate green: `pnpm turbo run type-check lint test build` → **16/16** (connectors-service **23/23**, api **46/46**, web **33/33**); `docker compose config` VALID.

**What it is:** a new **`apps/connectors-service`** (NestJS, :9100) that resolves + downloads social/web media via the **yt-dlp** binary (+ ffmpeg) and streams files back through Lyra's thin proxy. The browser only ever talks to Lyra; only Lyra talks to the service (token-gated, server-to-server).
- **Service** (`apps/connectors-service/src/`): `common/url.ts` SSRF guard (`assertSafeUrl` — blocks loopback/RFC-1918/link-local/IPv4-mapped-IPv6/IPv6-ULA); `download/ytdlp.ts` (argv-array spawn, never a shell; `mapResolveJson`→`MediaItem[]`); `download/file-store.ts` (uuid→path map, ephemeral temp + TTL sweep); `auth/service-token.guard.ts` (fail-closed Bearer gate); `download/` controller+service+dto = `POST /resolve`, `POST /download`, `GET /files/:id`. Dockerfile bundles yt-dlp + ffmpeg.
- **Lyra api** (`apps/api/src/connectors/`): proxy gained pure `rewriteDownload(ws, body)` (service `fileId` → `/workspaces/:id/connectors/files/:fileId`) + `streamFile()` + a `GET files/:fileId` stream-through behind `WorkspaceGuard`. **Mock mode unchanged** (`CONNECTORS_SERVICE_URL` unset → deterministic mock; publish/jobs/channels still mock).
- **Web** (`apps/web/src/pages/ImportMedia.tsx`): proxied (relative) file URLs download via authed `downloadFile` (carries JWT); absolute mock URLs via the anchor.
- **compose** (`docker-compose.yml`): opt-in `connectors` profile — `connectors-service` (builds from its Dockerfile), plus **Postiz** + **Cobalt** still only TEMPLATES (not built; see below).

**Going live (mock → real download), still MANUAL — not yet run:**
`docker compose --profile connectors up -d connectors-service` → set `CONNECTORS_SERVICE_URL=http://localhost:9100` + matching `CONNECTORS_SERVICE_TOKEN` in `apps/api/.env` → rebuild/restart api → Import UI: paste a public video URL → Fetch → Download.

**Follow-up minors (logged, none block merge — see `.git/sdd/progress.md`):** (1) add concurrency cap + `--max-filesize` (spec-listed, dropped); (2) `download.service` `readdir` should filter yt-dlp intermediates/sidecars, not return all temp files; (3) add `.dockerignore` / multi-stage build (image is large; yt-dlp pinned to `latest`); (4) proxy `streamFile` should gate the pipe on HTTP 200 (an expired-TTL 404 JSON body currently pipes through as the "file"); (5) optional: add stream `'error'` handlers to the proxy file route + pre-existing `runs.controller` asset routes (main-api crash hardening).

### What's NEXT (pick one)
- **Postiz publish v2** — the OTHER half of connectors. **NOT built**: Postiz is only a commented template in compose and the proxy `publish`/`jobs` endpoints hit the MOCK. Postiz software is **free, self-hosted** (AGPL, runs unmodified behind its HTTP API → no copyleft on Lyra; needs its own Postgres+Redis). Real cost/effort is **per-platform developer apps + app review** (TikTok/Meta/X/LinkedIn; X API has paid tiers). Start with brainstorming → spec → plan.
- **Download follow-up minors** (the 5 above) — small, fast hardening of v1.
- **Manual verification** of the real download path (the MANUAL steps above).

---

## Prior session (committed `a6658bb → ff37844`) — AI pipeline + copilot, i18n, dark mode, image gen, R2

Summary kept below for context. The big theme: a complete **AI pipeline + copilot** stack on the composable-pipelines model, plus **i18n (EN/VI)**, **dark mode**, **real image generation**, and **R2 media storage**. Design spec: [docs/specs/2026-06-18-lyra-ai-pipeline-copilot-design.md](specs/2026-06-18-lyra-ai-pipeline-copilot-design.md). (An earlier Codex chat-bridge fix — Prompt-library "Open in chat" no longer auto-submits, matches via `Conversation.originPromptId` + legacy first-message fallback — is also live in `Prompts.tsx`/`Chats.tsx`/`conversations/`.)

---

## 0. Resume the dev environment (do this first)

Live preview is **dev.getlyras.app** — a **cloudflared tunnel to THIS machine's dev servers** (discovered this session). It is only live while these run locally, and it shares this machine's database:
- **web** — Vite dev on `:5173` (HMR; auto-picks up web changes). **Mobile via the tunnel does NOT get HMR — full page reload.**
- **api** — `node dist/main.js` from `apps/api` on `:3001` (does **not** auto-reload).
- **mongo** — local on `:27017` (`docker compose up -d mongo`). dev.getlyras.app reads/writes this same DB.

**After any `apps/api` or `packages/shared` change you MUST rebuild + restart the api:**
```bash
pnpm --filter @lyra/shared build      # only if packages/shared changed — FIRST
pnpm --filter @lyra/api build         # (or: pnpm turbo run build --filter=@lyra/api)
# kill :3001, then start detached:
#   (PowerShell) Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
#   (bash, background) cd apps/api && node dist/main.js
# verify: curl http://localhost:3001/  -> 404 (app up); routes log on boot
```
Web changes need no restart (HMR).

**Full gate (what CI gates), all green:** `pnpm turbo run type-check lint test build` — 12 tasks, **35 api + 25 web tests**.

**Testing in your account:** use a **real login** with the user's creds (in `apps/api/.env` / provided for testing) — `POST /auth/login` for a token. (Forging a JWT from the signing secret is blocked by the auto-mode classifier; don't try it.) Workspace "Putiin's Workspace" = `6a309b8efe9ec7c83515dad5`; it has anthropic + openai + deepseek keys.

---

## 1. What shipped this session (committed `a6658bb → ff37844`)

| Commit | Feature |
|---|---|
| `a6658bb` | **Crawl provider** (`Provider.Crawl`, no key) + **per-step "View result"** modal (media inline, per-file/zip downloads, per-run history) |
| `2b6032b` | **i18n (EN/VI)** + **dark mode** + **AI Pipeline Builder Phase 1** |
| `9443439` | **Real image generation** (gpt-image-1) + **Step details** + Build-with-AI StrictMode fix |
| `2d8a483` | **Edit with AI** (revise an existing pipeline) |
| `04151c7` | **Conversational AI builder (Phase 2)** |
| `1a3327b` | **Lyra Copilot — read-only tools (Phase 3a)** |
| `249f632` | **Lyra Copilot — approval-gated actions (Phase 3b)** |
| `ff37844` | **Cloudflare R2 media storage** (env-gated, inline fallback) |

### AI pipeline builder + copilot (the core arc)
- **Build with AI** (Pipelines page → ✨): `POST /workspaces/:id/pipelines/generate { goal, current? }` → `PipelineAiService` (Claude) designs a pipeline **grounded to the public prompt library** (real prompt ids only; the server re-validates: unknown id → "gap" step with empty `promptId`; invalid provider·model → clamped to `MODEL_CATALOG`). Draft opens **editable in the builder**; save via the normal create endpoint. **Provenance**: `Pipeline.origin {source:'ai', goal, model}` + an "✨ AI-built" row badge.
- **Edit with AI** (builder toolbar): same endpoint with `current` steps → AI returns the COMPLETE revised pipeline; replaces the builder's steps.
- **Conversational (Phase 2)**: `BuildWithAiModal` is a chat — `POST …/pipelines/ai-chat { messages, current? }` → `{ reply, draft? }`. AI asks/refines across turns; "Apply to builder" drops the latest draft in.
- **Lyra Copilot** (Chats → ✨ Lyra Copilot; `CopilotPanel.tsx`): `POST /workspaces/:id/copilot { messages }` → `{ reply, tools?, actions? }`. `AnthropicClient.runWithTools` runs the agentic loop. **Read tools** (3a): `search_prompts, list_pipelines, get_pipeline, list_projects, get_project_runs, get_run_result` — grounds answers in real data. **Act tool** (3b): `run_pipeline` only **proposes** (resolves real ids → `PendingCopilotAction`); the panel shows an "Approve & run" card; on approve the **client** runs it via the existing run endpoints. The click is the gate — nothing runs unattended.
- New api: `apps/api/src/copilot/` (service/controller/module/dto) + `pipeline-ai.service.ts` (+ 5 unit tests). Shared dto: `GeneratePipelineDto`, `GeneratedPipeline/Step`, `AiChat*`, `Copilot*`, `PendingCopilotAction`, `PipelineOrigin`.

### Real image generation
- `image` provider is **real** now: `ImageStepProvider` → OpenAI **gpt-image-1** / DALL·E 3. It **reuses the workspace OpenAI key** — there is **no separate "image" key**. `keyProviderFor(provider)` (shared) maps `image → openai` for key resolution AND lock/gating across api + web. `MODEL_CATALOG[Image] = gpt-image-1 / dall-e-3`. **video is still a mock.**
- Storage: generated bytes go through `AssetStorageService.store()` → **R2 URL when the `R2_*` env is set, else an inline `data:` URL** (works for display + download; Node `fetch` handles `data:` URLs). To enable R2: set `R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL` in `apps/api/.env` (see `.env.example`), restart api. No code change to activate.

### Step details
- The "View result" modal is a full **step-details** view: meta strip (mode · tokens · duration) + Output/files + collapsible **Prompt sent** + **Input**. The run engine records `RunStep.sentPrompt` (the resolved prompt actually sent, with `{input}`/`{step:X}`/`{vars}` filled); falls back to the template on older runs.

### i18n + dark mode
- **react-i18next**, EN + VI, browser-default + persisted override. Per-area locale files under `apps/web/src/i18n/locales/{en,vi}/` (`common/nav/auth/home/settings/run/projects/pipelines/prompts/chats/copilot`). Header **flag toggle** (EN/VN) + borderless **theme toggle**; full controls in Settings → Preferences. Vitest setup `src/test/i18n-setup.ts` so tests assert real strings.
- **Dark mode**: `[data-theme="dark"]` token block in `index.css`; ~110 hardcoded `#fff`/disabled/placeholder values tokenized so cards/dialogs/fields flip. Follows OS (`prefers-color-scheme`), no-flash inline script in `index.html`, persisted (`src/lib/prefs.ts`).

---

## 2. AI roadmap — done vs next

- ✅ **Phase 1** — one-shot AI builder, image gen, step details, Edit-with-AI
- ✅ **Phase 2** — conversational builder
- ✅ **Phase 3a** — read-only copilot (tool grounding)
- ✅ **Phase 3b** — approval-gated act (run a pipeline) — the two-way is real
- ⏭️ **Phase 4 — closed loop**: copilot runs → reads results → improves the pipeline/prompt → re-runs → converges (the dropshipping-autopilot north-star, [docs/specs/2026-06-18-dropshipping-autopilot-northstar.md](specs/2026-06-18-dropshipping-autopilot-northstar.md)). **AUTONOMOUS + spends real money in a loop** — DO NOT build without the user setting guardrails (max iterations, budget cap, approval cadence). Build on the existing tool loop + `PendingCopilotAction` pattern.
- ⏭️ **Ratings + few-shot retrieval** — the "rate later" half of the feedback loop: thumbs on a run's **result** (not the pipeline), then feed top-signal pipelines into `PipelineAiService` as few-shot examples. Self-contained, no autonomous spend. Provenance (`origin`) is already captured as the seed.

> When "Keep going" was last said, the agreed default for the next safe step was **Ratings + few-shot retrieval**. Phase 4 needs a guardrail design first.

---

## 3. Gotchas / things not to break
- **Build-with-AI draft handoff**: the builder consumes the AI draft from `location.state` via a **ref-guard + `window.history.replaceState`** (NOT `navigate()` inside the mount effect — that raced `setSteps` under React StrictMode and dropped the steps). The modal **navigates before closing**. Don't reintroduce navigate-in-effect.
- **Gap steps persist**: `RunStep.promptId` and `PipelineStepItem.promptId` are **not `required`** (Mongoose String `required` rejects `''`); a gap step has `promptId: ''`. The `PipelineStepBody` DTO dropped `@MinLength(1)` on `promptId` too.
- **Copilot act = propose only**: `run_pipeline` never executes server-side; it returns a `PendingCopilotAction` and the client runs it on approval. Keep that boundary for any future act tools.
- **Image key**: image steps use the **OpenAI** key via `keyProviderFor`; don't add a separate image-key concept.

---

## 4. Still-pending (from earlier, unchanged)
- **Google sign-in** + **password-reset email** are code-complete but need secrets in `apps/api/.env` (`GOOGLE_CLIENT_ID`/`SECRET`; `SMTP_PASS`). Until set: Google button → `/login?error=google_unavailable`; mailer logs the reset link to a dev stub. **Never paste secrets in chat** — `apps/api/.env` only; rotate the tester creds.
- **Providers**: anthropic + openai/deepseek + crawl + **image (gpt-image-1)** are real; **video is still a mock**.
- The prior handoff's "pipeline should work like an image" exploration is **no longer the active task** (the session went the AI-builder direction).

## 5. Source-of-truth docs
`CLAUDE.md` (root) · `docs/lyra-pipelines.md` (composable pipelines) · **`docs/specs/2026-06-18-lyra-ai-pipeline-copilot-design.md`** (the AI builder/copilot design + roadmap) · `docs/specs/2026-06-18-dropshipping-autopilot-northstar.md` · `docs/lyra-requirements.md` · `docs/lyra-hosting-cicd.md`.
