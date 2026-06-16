# Session handoff — continue here

> New session: open this file first (`docs/SESSION-HANDOFF.md`), then say what you want to continue.
> Branch: **dev** (clean, all pushed). Last commit: `fe93769`.

---

## 0. Resume the dev environment (do this first)

Live preview is **dev.getlyras.app** (cloudflared tunnel → Vite). Pieces:
- **web** — Vite dev on `:5173` (HMR; picks up changes automatically).
- **api** — `node dist/main.js` from `apps/api` on `:3001` (does **not** auto-reload).
- **mongo** — Docker on `:27017` (`docker compose up -d mongo`).
- **tunnel** — cloudflared → dev.getlyras.app.

**After a backend (apps/api or packages/shared) change you MUST:**
```bash
pnpm --filter @lyra/api build           # (shared first if shared changed: pnpm --filter @lyra/shared build)
# kill whatever holds :3001, then:
# (PowerShell) Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
# start: node dist/main.js  (cwd apps/api, picks up apps/api/.env, NODE_ENV stays 'development' so autoIndex is on)
```
Web changes need no restart (HMR). Verify: `curl localhost:3001/health` → 200.

Checks before committing (what CI gates): `pnpm turbo run lint type-check test build`.
e2e: `pnpm --filter @lyra/api test:e2e` (in-memory mongo, hermetic; provider clients are stubbed).

---

## 1. PENDING TASK — Linear design audit & enhancement (blocked on Figma MCP)

**Goal:** read the **Linear Design System (Community)** Figma, audit Lyra's UI against it, apply enhancements.

**Figma MCP status:** registered in Claude Code as `figma-dev` → `http://127.0.0.1:3845/mcp` (HTTP). The server works (handshake 200, `claude mcp list` shows ✓ Connected). **BUT** the chat session kept failing to *bind* the figma tools at startup (they never appeared in-session), so the audit never ran.

**To make a NEW session load the Figma tools (order matters):**
1. Open the **Figma desktop app** → the Linear file → **Dev Mode** (Shift+D) → right **Inspect** panel → **MCP** section → **“Enable desktop MCP server.”** Leave it open.
2. Confirm it's up: port 3845 listening (`Get-NetTCPConnection -LocalPort 3845`) and `claude mcp list` shows `figma-dev ✓`.
3. **Only then start a fresh Claude Code session** (MCP tools bind once, at startup — start it *after* the server is up).
4. In the new session, verify tools loaded: `ToolSearch "figma"` should return `mcp__figma-dev__get_code` / `get_variable_defs` / `get_metadata` / `get_image`. If still empty, the session didn't bind it — fully quit Claude Code and reopen (don't just reload the window).
5. In Figma, **select a component** (Buttons / Input Fields / etc.), then ask: *"read the figma button and audit ours."*

**Zero-setup fallback (no MCP):** in Figma Dev Mode, select a component → right-click → **Copy/Paste as → Copy as code (CSS)** → paste it into chat. I'll match ours to those exact values. This always works regardless of the MCP issue.

**Audit plan once specs are available** — compare Figma → Lyra and apply gaps:
- **Tokens:** color/neutral ramp, accent, **shadows/elevation**, **radii**, **control heights**, **type scale** (size/weight/tracking).
- **Components:** buttons, inputs/text fields, menus/dropdowns, badges, **toggles**, focus rings, cards/rows.
- Lyra keeps its **orange `#FF6B1A`** brand accent (design invariant) — match Linear's *structure/spacing/states*, not their indigo.

### Where Lyra's design lives
- `apps/web/src/index.css` — **active** short-name tokens used by components: `--primary`, `--primary-hover/-pressed/-tint`, `--app-bg`, `--surface-1/2/3`, `--field`, `--hairline`, `--hairline-strong`, `--ink`, `--ink-muted/-tertiary`, `--danger`, `--radius-sm/md/lg`, `--radius-control` (6px), `--control-h` (32px), `--surface-hover`, `--shadow-sm/md/lg`. Also the **button system** (`.btn-primary` / `.btn-ghost` soft-filled secondary / `.btn-danger`) and `.text-input`.
- `apps/web/src/layout/layout.css` — **all component CSS** (big file): lists (`.ptable` / `.prow`), Linear toolbars (`.lin-toolbar` / `.lin-search` / `.lin-filter` / `.lin-menu` / `.lin-chip` / `.lin-add`), chat (`.chat-*`, `.cmsg` / `.cbubble` / `.ctext`, markdown `.md` / `.md-code`), prompt editor (`.pe-*`), model picker (`.model-pick` / `.model-pill` / `.model-menu`), composer (`.composer-box` / `.composer-input` / `.composer-bar` / `.composer-add`), settings (`.set-section` / `.key-row` / `.model-group`), icon buttons (`.icon-btn` / `-primary` / `-danger`), flow/builder (`.flow-*`, drag `.flow-grip`).
- `apps/web/src/styles/tokens.css` — parallel Tailwind v4 `@theme` (`--color-*`) layer (utilities); the hand-written components use the index.css names.
- `apps/web/src/layout/icons.tsx` — 16px line icons.
- Shared components: `apps/web/src/components/` — `Markdown.tsx`, `ModelPicker.tsx`, `AttachmentPreviews.tsx`, `TagInput.tsx`, `ConfirmDialog.tsx`.

---

## 2. What shipped this session (all on `dev`, pushed)

**Models / providers**
- New `apps/api/src/models/` module: per-(workspace,provider) model catalog fetched live from the provider's API and saved. `GET /workspaces/:id/models` (effective = stored-or-default) + `POST /workspaces/:id/keys/:provider/models` (refresh). Curated to current flagships via `apps/api/src/models/model-curation.ts` (Anthropic latest per tier; OpenAI newest GPT family + newest o-series; DeepSeek current). Settings page has a **Refresh models** button per provider.
- Real providers: **Anthropic** (native), **OpenAI + DeepSeek** via `OpenAiCompatClient`/`OpenAiCompatStepProvider`. OpenAI accepts **images** (data-URI); DeepSeek text-only; image/video still MockStepProvider. Static-catalog gating removed — `looksLikeModelId` picks a real id over a fixed-step display label.

**Prompt testing chat** (`/prompts/:id/test`, `PromptPlayground.tsx` + `prompt-tests` module)
- Claude-style: **markdown rendering** (react-markdown + remark-gfm, dark copyable code blocks), prompt **name/status/tags in the header** (separate from the thread), **auto-scroll pauses** when you scroll up, **Stop cancels the provider call** (AbortSignal threaded controller→run→clients) and persists the partial. One white framed panel, no separators.

**Create/Edit are now full pages** (modals removed): `/prompts/new`, `/prompts/:id/edit` (`PromptEditor.tsx`), `/projects/new`, `/projects/:id/edit` (`ProjectEditor.tsx`), `/pipelines/new` (`PipelineCreate.tsx` → builder). Prompt editor mirrors the test page: title + tags(left)/Public-toggle(right) row (no labels) + **live Markdown preview area** on top + **small composer at the bottom** (attach + **model picker** + char count). Prompts now persist a **default provider+model** (`Prompt.provider/model` in shared + Mongo + DTOs); the playground pre-selects them.

**Lists** (Prompts/Pipelines/Projects): whole **row navigates** to detail (actions stop-propagation); **client-side paging** (10–15/page); the **create action is a "+" icon** in the search toolbar (opens the page).

**Settings**: two sections — **Provider keys** (mobile: full-width input, action buttons below) + **Models** grouped by provider with refresh. Icon buttons; password-style key inputs; "key set" indicator.

**Infra fix**: Vite dev proxy served the SPA for navigations to `/prompts` `/projects` `/pipelines` (they're both API prefixes *and* SPA routes) — fixed the `Cannot GET /prompts`-on-reload bug. See `apps/web/vite.config.ts`.

Mockups (reference, not built into app): `docs/mockups/prompt-editor*.html`.

---

## 3. Open follow-ups / notes
- **Linear/Figma audit** — the main pending item (section 1).
- **Bundle size**: web JS is ~547 KB (gzip ~166 KB) after adding react-markdown to chat + editor. Optional: lazy-load `Markdown.tsx` so those libs load only on the test/editor pages.
- **Security**: the tester account password (`Tholv.7990@gmail.com`) was shared in chat earlier — **should be rotated**. Never commit it.
- Live provider testing: model *listing* (refresh) works without balance; actual chat completions need provider credit (DeepSeek/OpenAI accounts were out of balance; Anthropic key not set on that workspace).
- `mongodb` MCP server shows "Failed to connect" in `claude mcp list` — unrelated to the app (the app uses its own Mongoose connection); ignore.

## 4. Source-of-truth docs
`CLAUDE.md` (root) · `docs/lyra-pipelines.md` (business model v2) · `docs/lyra-prompt-testing.md` · `docs/lyra-requirements.md` · `docs/lyra-hosting-cicd.md` · `docs/lyra-design-system.md` (note: dark tokens there are superseded by the light/Linear `index.css`).
