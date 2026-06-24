# Lyra Redesign Prompt Pack

Ready-to-paste prompts to redesign **every** Lyra page, modal, and popup in Claude Design — **restyle only, preserve current structure + logic**. Derived from the live source, so each block is faithful to what the screen actually does.

## How to use

1. In Claude Design, set **Design system → Lyra Component Library** (the real synced components).
2. Click **+** and **attach the screenshot** named in the block (capture them all with `node scripts/capture-screens.mjs` → `docs/redesign-screens/`).
3. Paste the **Master prompt** (§1), set its `SCREEN:` line from the block, and paste the block's **Preserve / States / Rules / Restyle goal** as the screen-specific section.
4. **One screen per message.** Deliver light + dark, desktop 1240 + mobile 390. The master prompt's INVENTORY → MAP → REDESIGN → COVERAGE-CHECK loop is what guarantees nothing is dropped.

> Screenshot names below follow the capture script (`<name>.desktop.png` / `.mobile.png`; modals as `<page>__modal-<title>.png`, or "open it manually" when a modal needs live data).

---

## 1. Master prompt (paste for every screen)

```
You are RESTYLING one existing screen of Lyra (a web app where dropshipping teams
research winning products and run AI creative pipelines). This is a visual restyle,
NOT a behavior redesign.

DESIGN SYSTEM: use the selected "Lyra Component Library" as the only source of
components and styling. One blue accent (#0075DE), warm-neutral surfaces, system font,
flat with hairlines, full light + dark. Read the library README/conventions first.
Never invent a color, control, or component.

SCREEN: <paste the block's SCREEN line> — see the attached screenshot (current state).

ABSOLUTE RULE — preserve everything, change only the look:
- Reproduce the screenshot's EXACT information architecture: same sections in the same
  order, same data fields, same controls/actions, same navigation, same copy/labels.
- Do NOT add, remove, rename, reorder, merge, or rewire anything. Every field, button,
  menu, badge, column, and state must still exist and behave identically.
- Change ONLY visual design: hierarchy, spacing, typography, color, component usage,
  alignment, responsive layout.

COMPLETENESS PROTOCOL — follow in order, do not skip step 1:
1. INVENTORY (before designing): from the screenshot + the "Preserve exactly" notes
   below, list EVERY element — each section, data field/label, control (button,
   dropdown, toggle, icon-action, link, input), badge/pill/status, list/table column,
   and each visible or implied state.
2. MAP each item to the Lyra component or token it will use (dropdowns → MenuPicker;
   view=eye / delete=✕ / add=＋ via IconButton; status → StatusPill; cards → lib-card;
   dialogs → Modal/ConfirmDialog; buttons → btn-primary/ghost/danger; text → --text-*;
   status colors → running=primary, awaiting=warning, done=success, error=danger).
3. REDESIGN for desktop (1240px) AND mobile (390px), in light AND dark, keeping each
   item's position and behavior. Keep every state listed.
4. COVERAGE CHECK (output last): a table of every step-1 item → its counterpart in the
   redesign → the component/token used. Flag anything you could NOT carry over (should be
   nothing). If inventory and redesign don't match 1:1, fix it.

SCREEN-SPECIFIC (preserve exactly / states / rules / restyle goal):
<paste the block below>

DELIVER: light + dark, desktop + mobile, every state, with the coverage table.
```

---

## 2. Pages — workspace & library

### Home — `/`
**Attach:** `home.desktop.png`
**SCREEN:** Dashboard hub with getting-started onboarding and feature discovery cards (`/`).
**Preserve exactly:** Header with greeting, workspace name, type, and role; optional email-verification warning banner; collapsible Getting-Started progress card (title, icon, progress bar 0–100%, step list [keys/prompt/pipeline/project] with checkmarks, colored CTAs for next step); grid of 8 feature tiles (Marketplace/Prompts/Pipelines/Projects/Import/Publish/Settings/Members) each with tinted-bg icon, optional count badge (top-right), title, body, rightward arrow; tiles navigate to their routes or show "Coming soon"; Settings tile shows "Action needed" badge if no API keys.
**States:** unverified email (banner visible); getting-started complete (auto-collapses, stays visible); no workspace (error heading).
**Rules:** Getting-started auto-collapses after all 4 steps (first visit); user's localStorage collapse preference wins; Chats intentionally hidden from tiles (it's the FAB); count badges come from live workspace stats.
**Restyle goal:** Improve grid hierarchy, badge prominence, progress feedback; tighten hero→explore spacing; enhance tile hover.

### Projects — `/projects`
**Attach:** `projects.desktop.png`
**SCREEN:** Projects board with search, status/creator filters, pagination (`/projects`).
**Preserve exactly:** Header (title + subtitle); toolbar (search input, Filter button → multi-select ProjectStatus + creator, New Project); result range meta; paginated grid (9/page) of project cards: title (→ `/projects/:id`), status pill (draft/public), description, variables (key=value up to 4), platform channel dots, footer (creator avatar + name + date + Open); delete icon (creator/owner only).
**States:** loading; empty (CTA to create); no matches; paginated.
**Rules:** Only creator + owner delete; pagination resets on filter change; filters OR within a group, AND across; channel dots resolved from the pool.
**Restyle goal:** Cleaner card layout, better footer spacing, emphasize status in the header row.

### Project Detail — `/projects/:id`
**Attach:** `project-detail.desktop.png`
**SCREEN:** Project overview: channels, posts, products, and a tasks kanban (`/projects/:id`).
**Preserve exactly:** Fixed header strip (title, close, byline avatar+creator+date, status pill, edit if permitted); scrollable sections: Channels (label+count, Publish button, list/empty, manage link if editor), Posts (up to 8: status dot, caption, outlet links, date), Products (embedded ProjectProducts), Tasks (label, New Task if permitted, kanban with status columns new/in-progress/on-hold/complete + add composer).
**States:** loading; not found; per-section empty states.
**Rules:** Close → `/projects`; Edit → `/projects/:id/edit`; Publish → `/publish?project=:id`; New Task opens inline composer; posts show up to 8; unconnected channels show dashed empty state.
**Restyle goal:** Better section separation, kanban readability, sticky header on scroll.

### Project Editor — `/projects/new` · `/projects/:id/edit`
**Attach:** `project-new.desktop.png`
**SCREEN:** EditorShell form: name, description, variables, brand kit, channels, status, visibility.
**Preserve exactly:** EditorShell (breadcrumb to Projects, close, save ✓); auto-focused title input; sections: Description (textarea), Variables ({key}=value list, Add, quick-add chips product/niche/homepage), Brand Kit (logo upload + accent color), Channels (grouped by connector type, checkboxes), Status (Draft↔Public toggle), Visibility (public-only; two cards All/People; People → member checklist). Error banner; Save disabled until name present.
**States:** loading (edit); access denied (non-creator/owner); unsaved-changes hint.
**Rules:** Channels filtered to connected pool (disconnected auto-removed on save); visibility only shows when Public; variable keys sanitized to alphanumeric+underscore; logo validated (type + 5MB).
**Restyle goal:** Better form grouping, clearer visibility picker cards, clearer channel grouping.

### Prompts — `/prompts`
**Attach:** `prompts.desktop.png`
**SCREEN:** Prompt library with type pills + status/tag/provider/creator filters, sort, pagination (`/prompts`).
**Preserve exactly:** Header; toolbar (search, Filter → status/tags/providers/createdBy, New Prompt); type pills row (All + per-type counts); result meta + sort (updated / A–Z); paginated grid (15/page) of cards: title (→ detail modal), status pill, type + color dot, saved-result count (sparkle), mono content preview, tag chips, footer (creator avatar+name+date + Open-in-Chat / Edit / Delete). Detail modal shows full content.
**States:** loading; empty; no matches; detail modal open (copy).
**Rules:** Owner-only edit/delete; saved-count from `prompt.results`; filters OR within / AND across; type pill is single-select (separate from Filter popover); sort persists across pages.
**Restyle goal:** Improve card density, status/type indicators, action-button grouping.

### Prompt Editor — `/prompts/new` · `/prompts/:id`
**Attach:** `prompt-new.desktop.png` (or `prompt-edit.desktop.png`)
**SCREEN:** Editor for prompt title, content, type, public/draft, labels, media.
**Preserve exactly:** EditorShell (breadcrumb to Prompts, close, save ✓); auto-focused title; type + Public/Draft toggle on one row; LabelPicker (tags + create); Composer (content textarea, media upload, model picker provider+model, ⌘+Enter hint, char count). Unsaved-changes blocker (Discard/Save). Error banner.
**States:** loading (edit); access denied (non-owner); dirty.
**Rules:** Save needs title + content-or-media; dirty guard blocks navigation; media type+size validated; save clears dirty.
**Restyle goal:** Tighten composer, better label flow, improve media preview.

### Pipelines — `/pipelines`
**Attach:** `pipelines.desktop.png`
**SCREEN:** Pipeline library with search, filters (tags/creator/AI-only/gate-only), pagination (`/pipelines`).
**Preserve exactly:** Header; toolbar (search, Filter → tags/creators + AI-only + gate-only, "Build with AI", New Pipeline); result meta; paginated grid (9/page) of cards: title, badge row (step count / "AI-built" if origin.source=ai), step-flow strip (number + name + gate indicator + chevrons), tag chips, footer (creator + date + Duplicate / Delete / Open).
**States:** loading; empty; no matches.
**Rules:** Creator/owner delete + duplicate; AI-only filters origin=ai; gate-only filters StepMode.Gate; filters OR within / AND across.
**Restyle goal:** Improve step-flow readability, badge positioning, duplicate/delete clarity.

### Pipeline Builder — `/pipelines/new` · `/pipelines/:id`
**Attach:** `pipeline-builder.desktop.png` (or `pipeline-new.desktop.png`)
**SCREEN:** Pipeline editor (canvas desktop / vertical pager mobile) + step drawer + test-run mode with RunFlow.
**Preserve exactly:** EditorShell (breadcrumb, close, save ✓); header row (name input [disabled in run mode], description + tags); controls (Test ▶ if not new, "Edit with AI" sparkle); edit mode: canvas/vertical flow with +connector between steps, StepCards (number + name + prompt indicator + gate badge + edit/delete/move/insert); test mode: Run bar (back, run #, status badge, Run All / Stop / Reset) + RunFlow (per-step status + inline gate Approve). Step drawer: type chooser (Prompt step / Brand action), prompt picker or brand fields, fan-out + condition controls, ✓/✕.
**States:** loading; run mode; edit mode; step drawer open; "no prompts available" warning.
**Rules:** Public prompts only in picker; unsaved edits auto-save before test; test run persists across back-to-edit; AI draft applies once; fan-out parallel per item; conditions skip steps; brand actions use ActionType.
**Restyle goal:** Better step-card hierarchy, clearer fan-out/condition UI, improved drawer header.

### Marketplace — `/marketplace`
**Attach:** `marketplace.desktop.png`
**SCREEN:** Curated prompts with AI-ranked results, category pills, filters, search (`/marketplace`).
**Preserve exactly:** Header; toolbar (search + AI toggle + Filter for type/forDevs); AI banner (when ranked); category pills (All + per-category counts); result meta + sort (newest / A–Z, browse only); paginated catalog (30/page) or ranked results. Card: category badge + type badge, title, description, (if ranked) AI score + reason, mono content preview, tag+variable chips, footer (contributor avatar + Preview / Copy / Adopt + copy toast). Detail modal; adopt confirm.
**States:** loading; browse; ranked (no pills/meta/sort, full-width); no ranked results; no browse results.
**Rules:** AI search toggles browse↔ranked; unverified users browse but can't adopt; ranked hides pills; adopt shows "Added"; copy → clipboard + toast.
**Restyle goal:** Better badge clarity, card metadata layout, emphasize AI score when present.

### Products — `/products`
**Attach:** `products.desktop.png`
**SCREEN:** Product board (kanban: candidate/validating/testing/scaling/declining/killed) + detail sidebar + add modal (`/products`).
**Preserve exactly:** Toolbar (title + Add Product); ProductBoard with status columns of draggable cards (name, niche, images, actions); detail sidebar (ProductDetail: edit name/niche/category/price/compareAtPrice/offer/source/images, save/delete, runs/decisions history); add modal (name, niche, category, price, compareAtPrice, offer, source URL, images CSV/newline, Cancel/Add).
**States:** empty; cards in columns; sidebar open; add dialog open.
**Rules:** Drag between columns updates `product.status`; card click opens detail; add modal clears on save; name required.
**Restyle goal:** Cleaner board, better thumbnails, tighter form fields. (Decision/score/grade should use the research explainability tokens where present.)

### Chats — `/chats` · `/chats/:id`
**Attach:** `chats.desktop.png`
**SCREEN:** Conversation workbench: history sidebar + chat pane + optional saved-results rail (`/chats`).
**Preserve exactly:** Header (mobile menu/history toggle, breadcrumb with optional origin link / title, close); left sidebar (New Chat, Copilot, recent-20 list: provider icon + title + model + message count + last date + delete, Show More); main ChatPane (messages user/assistant, composer with provider+model picker, media/file, Send); right SavedResults rail only when linked to a prompt (parent results + delete); Save-as-Prompt modal; page error banner.
**States:** fresh canvas (no :id); existing (:id); history open/closed (mobile); results rail visible (linked); saving.
**Rules:** New Chat resets state; back/breadcrumb clears origin; Save-as-Prompt creates prompt + first result; answers savable to parent prompt; delete removes from list; origin persists via sessionStorage per conversation id.
**Restyle goal:** Better sidebar/main balance, message grouping, tighter composer controls.

### Components — `/components` *(dev reference, not a product screen)*
**Attach:** (no redesign — this is the design-system gallery)
**SCREEN:** Internal dev gallery of every component at real tokens.
**Preserve exactly / Rules:** Internal tooling, hardcoded English (no i18n by design), token-only styling, Vitest-snapshotted. **Do not restyle** — use it as the consistency reference.

### Task Detail — `/projects/:id/tasks/:taskId`
**Attach:** `task-detail.desktop.png`
**SCREEN:** Task workbench: editable metadata + pipeline tabs + run viewer/history.
**Preserve exactly:** EditorShell (breadcrumb to project, close); inline-editable title + description (✓ when dirty); properties row (TaskStatusPicker, TaskPriorityPicker, Assignee menu [team-only], Labels); pipeline tabs (one per assigned pipeline + Add Pipeline menu); active tab: Run header (run selector / status badge / created-by + Run All / Stop / Reset + optional rating) + RunTimeline (vertical per-step status) + earlier-runs (collapsed). Empty states for no-pipelines / no-runs. Error banner.
**States:** loading; not found; no pipelines; no runs; run selected; earlier runs visible.
**Rules:** Project-editor only; status/priority/assignee/tags PATCH immediately; tabs filter runs per pipeline; earlier runs read-only; product picker prefills a run; assignee menu hidden in personal workspaces.
**Restyle goal:** Improve tab layout, tighten run header, better section separation.

### Task Editor — `/projects/:id/tasks/:taskId/edit`
**Attach:** (open from Task Detail / project)
**SCREEN:** Lightweight EditorShell to edit task **name + description only** (status/priority/assignee/tags live on the detail page).
**Preserve exactly:** EditorShell (breadcrumb to project, close); auto-focused name; description textarea; error banner; save ✓ (enabled only if name present).
**States:** loading; access denied; saving.
**Rules:** Save → back to `/projects/:id/tasks/:taskId`; project-editor only.
**Restyle goal:** Clean, minimal form layout.

---

## 3. Pages — settings, team, ops, auth

### Settings — `/settings`
**Attach:** `settings.desktop.png`
**SCREEN:** API keys + preferences + password.
**Preserve exactly:** Preferences (language + appearance toggles) up top; Providers section (catalog grid available/added/coming-soon, add-provider dropdown + button, replace/remove per key card, model load/refresh UI); special Postiz / Tavily / Firecrawl key sections; Password section (3 inputs + update + ok/error); add/replace-key, request-provider, remove-confirm modals; role-gated (non-key-managers see hint only).
**States:** loading / empty (no keys) / error; password validation (length, match); replace flow; per-provider model refresh pending.
**Rules:** `canManageKeys` guards all key mutations + visibility; password ≥8; workspace-scoped; non-owners read-only hint; keys show **last4 only**.
**Restyle goal:** Modernize toggles, reduce provider-card density, improve section hierarchy.

### Members — `/members`
**Attach:** `members.desktop.png`
**SCREEN:** Team roster + invite + roles.
**Preserve exactly:** Header (title + workspace name); search + role filter popover + Invite (owner-only); people lib-grid cards (avatar · name · email · role badge, role dropdown + remove icon owner-only); pending-invites section (avatar + email + role + revoke); invite form (email + role + send/copy-link); solo-workspace hero card (gradient + avatar roster + perks + upgrade CTA) when not a team.
**States:** loading / empty / filter-empty / invite form open / invite link shown; pending invites conditional.
**Rules:** Owner-only role change/invite/remove; can't remove self; workspace type gates hero vs list; role filter multi-select.
**Restyle goal:** Elevate the upgrade hero, clarify invite flow, refine card spacing.

### Connections — `/connections`
**Attach:** `connections.desktop.png`
**SCREEN:** Social channel + publishing account management.
**Preserve exactly:** Title + subtitle; stat strip (connections, total accounts, distinct platforms); add-connection button; per-connection card (GoLogin or Postiz pool: icon + name + account count + status pill + add-account / manage-in-Postiz / options menu); account rows (avatar + name + platforms + delete or spacer); media-import service card (status pill); add-channel modal (platform select + display name + GoLogin profile ID + proxy, locked when adding to existing profile); mobile bottom-add strip for GoLogin.
**States:** loading / empty / error; per-connection empty channels; modal (add channel vs add account).
**Rules:** GoLogin profile ID locked when adding to an existing profile; Postiz accounts managed in Postiz (no delete); media import always-connected badge; workspace-level.
**Restyle goal:** Streamline card headers, account-row readability, service badges.

### Publish Composer — `/publish`
**Attach:** `publish.desktop.png`
**SCREEN:** Multi-channel social post composer.
**Preserve exactly:** Title + subtitle; left: channels card (project picker + grouped channel checkboxes + selection summary), caption card (textarea max 2200 + char count + hashtag/template tools), media card (URL input + add + thumbnails with remove + crawler link); right: preview panel (tabbed per channel mock post), recent-posts card (caption + platforms + date + status); footer Publish (disabled if no channels, shows count); mobile sticky publish bar; results card (per-channel receipts: status + link or error).
**States:** loading / no channels / publishing (polling) / done / failed; caption over limit; receipts inline.
**Rules:** Publish disabled if no channels; caption max 2200; job polls ~1.5s until done/failed; project selection preselects its channels (editable); receipts show on completion; preview shows first media URL.
**Restyle goal:** Balance composer↔preview, simplify channel selector, elevate recent-posts card.

### Import Media — `/import`
**Attach:** `import.desktop.png`
**SCREEN:** Media crawler + downloader.
**Preserve exactly:** Title + subtitle; composer card (textarea + platform chips + Fetch + cookies strip + status); queue (count badge + Clear + per-URL CrawlSource card: type glyph · URL · status pill · remove; resolved → media grid: type badge · thumb · filename · quality picker · download; progress bar; download-all footer); recent (All/Video/Image segment + table of source · items · status); error retry; per-card empty states.
**States:** resolving / resolved / error (retry) / downloading (single or batch); no URLs / no recent.
**Rules:** parseLinks dedupes/validates http(s); default quality highest ≤720p; expired job shows retry; cookies workspace-scoped.
**Restyle goal:** Simplify media-tile density, improve download progress, refine queue-card header.

### Monitor — `/monitor`
**Attach:** `monitor.desktop.png`
**SCREEN:** Competitor + ads monitoring dashboard.
**Preserve exactly:** Title + subtitle; stats strip (new today, stopped today, watching); discover input + button (comma/newline keywords); tabs (changelog / watchlist / approvals with counts); changelog feed (by-day, clickable media thumbs), watchlist (competitors · ads · remove), approvals (candidates with approve/reject); media-viewer modal; key-missing gate → CTA to Connections.
**States:** loading / no-key error (gate) / normal; per-tab empty/loaded/discovering; media viewer open.
**Rules:** Apify key required (no-key blocks the rest); discover runs on keywords; approve/reject/remove update; stats refresh on approve.
**Restyle goal:** Improve stat strip, refine tabs, clarify discover input.

### Admin — `/admin`
**Attach:** `admin.desktop.png`
**SCREEN:** Super-admin operations dashboard.
**Preserve exactly:** Tab nav (overview / users / requests / platform); Overview (stat grid users/workspaces/projects/pipelines/prompts/runs/chats/signups30d + recent signups list); Users (search + cards avatar·name·email·status·joined·workspace-count, pagination; card → UserDetailView: back + header + workspaces + usage grid + deactivate/reactivate with confirm); Requests (type+status filters + cards badge·subject·votes·body·meta·status dropdown); Platform (catalog card count·last-synced + sync).
**States:** loading / error / per-tab; nested user detail; requests empty; catalog syncing; deactivate confirm.
**Rules:** Non-admin → redirect `/`; can't deactivate self; deactivate needs confirm; 15/page; requests inline status change; no pagination on overview/platform.
**Restyle goal:** Improve tab separation, stat-grid layout, request-card density.

### Login — `/login`
**Attach:** `login.desktop.png`
**SCREEN:** Email/password login with Google fallback.
**Preserve exactly:** AuthTopBar (theme + language toggles); auth-card (BrandLogo · "Sign in to Lyra" · subtitle · error/notice · GoogleButton · "or" divider · email · password with eye-toggle · forgot-password link · sign-in button · "Don't have an account" → signup); URL params error=(google|google_unavailable) and verified=(0|1) map to error/notice copy.
**States:** pristine / submitting ("Signing in", disabled) / error / verified-email notice.
**Rules:** Email + password required; eye toggle preserves input type; Google failure shows vague/unavailable copy.
**Restyle goal:** Refine eye-toggle size, error visibility, divider styling.

### Signup — `/signup`
**Attach:** `signup.desktop.png`
**SCREEN:** Registration with email-verification gate.
**Preserve exactly:** AuthTopBar; auth-card two states: (1) form — BrandLogo · "Create an account" · subtitle · GoogleButton · "or" · name · email · password (min 8) · sign-up · have-account → login; (2) sent — "Verify your email" · subtitle · notice (email shown) · have-account → login.
**States:** ready / submitting / verification-sent (form replaced).
**Rules:** Password ≥8 client check; server validates uniqueness; verification required (sentTo gate).
**Restyle goal:** Streamline state transitions, clarify verification messaging.

### Forgot Password — `/forgot-password`
**Attach:** `forgot-password.desktop.png`
**SCREEN:** Reset-link requester.
**Preserve exactly:** AuthTopBar; auth-card two states: (1) "Reset your password" · subtitle · error · email · send-link button · remembered → login; (2) sent — subtitle with email · back-to-login.
**States:** ready / submitting ("Sending reset link") / sent.
**Rules:** Email required; no retry from sent (back to login).
**Restyle goal:** Improve sent-state messaging, button copy.

### Reset Password — `/reset-password?token=…`
**Attach:** `reset-password.desktop.png` (reached via emailed link)
**SCREEN:** Token-gated new-password form.
**Preserve exactly:** AuthTopBar; auth-card three states: (1) missing token — error + request-new-link → forgot-password; (2) form — "Reset your password" · subtitle · error · new-password · confirm-password · reset button; (3) success — "Your password has been reset" · sign-in → login.
**States:** no token / ready / submitting / success.
**Rules:** Token required; password ≥8; confirm must match (client); server validates token; no back from success.
**Restyle goal:** Clarify form states + success messaging.

---

## 4. Modals & popups

> Full **modals** open on a scrim; **popovers** anchor to a trigger. All close on Escape; modals also close on scrim click, X top-right. Reuse the Lyra `Modal` / `ConfirmDialog` and `MenuPicker` (never a native `<select>`).

### Add / Replace API Key (modal) — Settings ▸ Providers ▸ Add
**Attach:** `settings__modal-*.png`
**SCREEN:** (modal) Add/Replace `{provider}` key.
**Preserve exactly:** Provider badge + heading; password input (masked, trimmed, "Paste key here"); optional "Get key ↗" link; Cancel (ghost) + Save (primary, disabled while empty/busy); Enter submits; autofocus.
**States:** empty / focused / busy ("Saving…") / error (red above form).
**Rules:** Write-only key (never echoed); one provider per modal; Save disabled until non-whitespace; X top-right; Escape/scrim close; key stored shows **last4 only**.
**Restyle goal:** Lyra Modal, `text-input` with muted label, ghost/primary buttons, `--danger` error.

### Confirm Dialog (modal) — any delete/destructive action
**Attach:** open it from any delete/destructive action
**SCREEN:** (modal) Minimal confirm — title + message + two buttons.
**Preserve exactly:** Title + message; ghost Cancel + primary/danger confirm (per `danger` prop); both disabled while busy; confirm shows "Working…" when busy; `open` gates render.
**States:** idle / busy (disabled, "Working…") / closed (null).
**Rules:** Escape + scrim → onCancel; `danger` → red confirm; pure confirmation (no form).
**Restyle goal:** Lyra `ConfirmDialog` — `btn-danger` or `btn-primary` confirm, `btn-ghost` cancel.

### Save as Prompt (modal) — Chat ▸ Save to library
**Attach:** open it from a chat message's Save action
**SCREEN:** (modal) "Save to library".
**Preserve exactly:** Autofocused title (required); LabelPicker (tags + create); Toggle for public; textarea body (prefilled with the message); Cancel (ghost) + Save (primary, disabled if title/body empty or busy); error above form; carries the message's provider·model.
**States:** empty / typing / busy ("Saving…") / error / success (closes).
**Rules:** Title + body required (trimmed); Save disabled while incomplete; Escape closes.
**Restyle goal:** Lyra Modal, `text-input` title, LabelPicker as-is, body styled like `text-input`, Toggle + buttons per system.

### Request Provider (modal) — Settings ▸ Request a provider
**Attach:** `settings__modal-*.png`
**SCREEN:** (modal) "Request a provider".
**Preserve exactly:** Provider badge; autofocused name (required); optional note textarea; Cancel (ghost) + Send (primary, disabled while empty/busy); error; submits a `provider` UserRequest.
**States:** empty / typing / busy ("Sending…") / error / submitted.
**Rules:** Name required; note optional (→ undefined if empty); X top-right; Escape closes.
**Restyle goal:** Lyra Modal, IconButton X, `text-input` + textarea, ghost/primary.

### Request Team Upgrade (modal) — Members ▸ Upgrade workspace
**Attach:** `members__modal-*.png`
**SCREEN:** (modal) "Request team upgrade" (same shape as Request Provider).
**Preserve exactly:** X close, name (required) + note, Cancel + Send; submits a `team-upgrade` UserRequest with workspaceId; identical busy/error/validation.
**States:** empty / typing / busy / error / submitted.
**Rules:** Name required; note optional; Escape closes.
**Restyle goal:** Lyra Modal, IconButton X, `text-input` + textarea, ghost/primary (shares shape with Request Provider).

### Run Variables (drawer-modal) — Pipeline ▸ Run
**Attach:** open it from Run on a pipeline that has variables
**SCREEN:** (drawer on scrim) Fill run variables + fan-out collections.
**Preserve exactly:** Title (pipeline name) + subtitle; one field per PipelineVariable (label or key, placeholder from default/prefill); one textarea per collection (one item per line); Cancel (ghost) + Run (primary, disabled while busy).
**States:** empty / filled / busy ("Starting…") / scrolled.
**Rules:** Escape + scrim close; scroll-lock; variables trimmed; collections split newline + filter empty; prefill seeds fields.
**Restyle goal:** Drawer + scrim, `text-input` variables, textarea collections, ghost/primary, muted help labels.

### Task Create (modal) — Project ▸ New task
**Attach:** `project-detail__modal-*.png`
**SCREEN:** (modal) "New task".
**Preserve exactly:** Badge + "New task" header + X; autofocused name (required); description textarea; property pills (TaskStatusPicker, TaskPriorityPicker, Assignee menu [team-only, with Unassigned], Labels); pipelines section (assigned list with ✕ remove + "+ Assign Pipeline" dropdown of available); sticky footer (info note "inherits variables" + Cancel + Create, disabled while name empty/busy); ⌘/Ctrl+Enter submits.
**States:** empty / filled / assignee menu open / pipeline menu open / busy / error.
**Rules:** Name required; omit assigneeId if null; pipelines array always sent; Escape closes; outside-click closes sub-menus.
**Restyle goal:** Scrim + dialog, `text-input` name/desc, MenuPicker assignee, Status/Priority pickers via MenuPicker, LabelPicker as-is, pipelines as removable chips, ghost/primary.

### Step Result (modal) — Run ▸ click a step
**Attach:** open it from a finished run step in the run view
**SCREEN:** (modal) Step result with version history + assets.
**Preserve exactly:** Header (step number + name + status badge); meta strip (mode Gate/Auto, provider·model, tokens, duration); version switcher (MenuPicker over run history, newest first, lazy-fetch assets per version, cached); media grid (files + download-all zip + per-file download) if assets; result text (copy button toggles Copy/Copied); error section if error; collapsible prompt-sent + input (current run only).
**States:** loading media / loaded / no assets / error / no result / success.
**Rules:** Version switch re-fetches+caches assets; download filename carries step index; only current run shows full prompt+input; Escape closes.
**Restyle goal:** Lyra Modal, MenuPicker version dropdown, status badges per status tokens, ghost Copy/Download buttons, responsive media grid.

### Build with AI (modal) — Pipelines ▸ Build/Edit with AI
**Attach:** open it from Pipelines "Build with AI" (or Edit with AI in the builder)
**SCREEN:** (modal) Chat that drafts a pipeline.
**Preserve exactly:** Sparkle title (edit mode = "Edit with AI") + X; scrolling chat (user right / assistant left, 3-dot typing); error; optional draft section ("✨ {name} · {step count}" + Apply); compose (textarea rows=2 + send button, ⌘/Ctrl+Enter sends, disabled while empty/busy).
**States:** empty / typed / thinking (3 dots) / draft received / error.
**Rules:** Escape closes; ⌘/Ctrl+Enter sends; draft shows only when returned; Apply → onApply (edit) or navigate `/pipelines/new`; busy disables send.
**Restyle goal:** Lyra Modal, chat bubbles (assistant muted), blue draft section, textarea + send, animated 3-dot typing.

### Copilot Panel (modal) — Copilot button (header/sidebar)
**Attach:** open it from the Copilot button
**SCREEN:** (modal) Read-only assistant over workspace data (same layout as Build-with-AI).
**Preserve exactly:** Chat messages; per-assistant-message tools badge ("🔧 tool · tool"); pending run-approvals (pipeline/project names + Dismiss + Approve Run); both disabled while acting; scroll-to-bottom; X close.
**States:** empty / typed / thinking / tools shown / pending actions / error.
**Rules:** Approve Run → POST then run-all, appends a summary; tools are read-only; Escape closes.
**Restyle goal:** Lyra Modal, chat layout, tools badge, Dismiss (ghost) + Approve Run (primary).

### Marketplace Prompt Details (modal) — Marketplace ▸ card
**Attach:** open it from a Marketplace card
**SCREEN:** (modal) Catalog prompt detail + adopt.
**Preserve exactly:** Hero (category pill + type pill + title + X); meta (contributor avatar + "by {name}" + source link); description; variables chips; prompt section (highlighted content + Copy [toggles] + Open in Chat); footer Add (primary; disabled+tooltip "Confirm email" if locked; "Adding…" busy; done → checkmark + "Added · View library").
**States:** idle / busy ("Adding…") / done.
**Rules:** Add disabled for unverified email; Escape + scrim close; read-only (no editing).
**Restyle goal:** Lyra Modal, category/type pills, Avatar, PromptCodeBlock for the prompt, primary/ghost, `--danger`/tooltip for the locked state.

### Prompt Details (modal) — Prompts ▸ card (eye)
**Attach:** open it from a library prompt card
**SCREEN:** (modal) Library prompt detail + saved results.
**Preserve exactly:** Title; edit + delete + close (only if allowed); meta (creator avatar + name + date, status pill, type pill); labels as TagChip; prompt content (PromptCodeBlock); SavedResults history (per-result date + delete with canDelete); refetches on mount; Open-in-Chat → `/chats/:id` with origin state.
**States:** idle / deleting a result / loading fresh data.
**Rules:** Edit/delete only if permitted (creator/owner); Escape closes; ChatOrigin preserved for back-nav.
**Restyle goal:** Lyra Modal, Avatar + pills, TagChip labels, PromptCodeBlock, ghost/danger actions.

### Filter Popover (popover) — Prompts / Pipelines / Projects / Members / Marketplace
**Attach:** open it from a gallery's Filter button
**SCREEN:** (popover) Filter menu with active count.
**Preserve exactly:** Trigger button (filter icon + label + count badge when active/open); `lin-menu` popover with Clear (disabled when count 0) + caller-supplied filter sections (labels + checkbox rows); closes on outside-click + Escape.
**States:** closed / open / active (badge count).
**Rules:** Escape + outside-click close; Clear disabled at 0; sections customizable.
**Restyle goal:** FilterIcon + text trigger, `lin-menu` structure, count badge (`--accent-*`), Clear as `btn-ghost`.

### Command Bar (popover-dialog) — ⌘/Ctrl+K, app-wide
**Attach:** open it with ⌘/Ctrl+K
**SCREEN:** (centered dialog) Command palette.
**Preserve exactly:** Scrim + centered dialog; autofocused search (clears on close); grouped command rows (icon + label + optional `kbd` shortcut); keyboard ↑/↓ navigate, Enter run, Escape close; active row highlighted; hover sets active; empty-results message.
**States:** closed / open / searching / empty / navigated.
**Rules:** Escape + ⌘K toggle/close; scroll-lock; case-insensitive label match; results re-grouped.
**Restyle goal:** Scrim + dialog, `text-input` search, grouped rows, styled `kbd`, active row `--primary`, empty message.

### Media Viewer (lightbox) — chat / composer / run-step media
**Attach:** open it from a media thumbnail
**SCREEN:** (modal) Media lightbox.
**Preserve exactly:** Header (filename + Open external link + X); body renders img / video (controls, autoplay) / audio (controls, autoplay) / other → iframe; ⌘/Ctrl/middle-click on the thumbnail bypasses the modal (normal navigation); Escape closes.
**States:** image / video / audio / file.
**Rules:** MediaType from shared; `useMediaViewer` provides open() + JSX (once per page).
**Restyle goal:** Lyra Modal, responsive media, ghost header buttons, X top-right.

### Model Picker (popover) — chat/builder footer model pill
**Attach:** open it from the model pill
**SCREEN:** (popover, opens upward) Provider·model picker.
**Preserve exactly:** Pill (provider icon 15px + model label + caret); menu grouped by Provider; rows (icon + name + checkmark when active provider+model); select → close + onChange; outside-click closes.
**States:** closed / open / active (checkmark).
**Rules:** Opens upward (bottom bar); skip providers with no models; one model active; outside-click closes.
**Restyle goal:** MenuPicker base, ProviderIcon pill, checkmark on active, provider group headers.

### Label Picker (popover) — Save-as-Prompt / Task Create ▸ Labels
**Attach:** open it from a Labels field
**SCREEN:** (inline popover) Tag selector + create-new.
**Preserve exactly:** Selected labels as chips (colored dot + name + ✕); Add → searchable dropdown (search input; Enter toggles or starts create); "Create new" appears when typed ≠ exact match → color picker grid (LABEL_COLORS, disabled while busy); Escape + outside-click close back to chips; onCreate async.
**States:** chips / open search / creating (color picker) / busy.
**Rules:** Normalize name/key for matching; Enter toggles or creates; color picker only on create; outside-click closes.
**Restyle goal:** `tag-chip` selected items, popover menu, `text-input` search, LABEL_COLORS grid, "Create new" with PlusIcon.

### Task Status Picker (popover-pill) — Task Create / Task Detail
**Attach:** open it from the Status control
**SCREEN:** (popover-pill) Status select.
**Preserve exactly:** MenuPicker (value=status, onChange); options from TASK_STATUS_ORDER (TaskStatusIcon 15px + label); single-select checkmark; `disabled` respected.
**States:** closed / open / active.
**Rules:** Icon colored per status; order from TASK_STATUS_ORDER; no multi-select.
**Restyle goal:** MenuPicker base + TaskStatusIcon per option; pill shows current icon + label.

### Task Priority Picker (popover-pill) — Task Create / Task Detail
**Attach:** open it from the Priority control
**SCREEN:** (popover-pill) Priority select (same as Status Picker).
**Preserve exactly:** MenuPicker (value=priority); options from TASK_PRIORITY_ORDER (TaskPriorityIcon + label); single-select; `disabled` respected.
**States:** closed / open / active.
**Rules:** Icon colored per priority; order from TASK_PRIORITY_ORDER.
**Restyle goal:** MenuPicker base + TaskPriorityIcon per option; pill shows current icon + label.

### Platform Select (popover) — connections / publishing settings
**Attach:** open it from a platform picker
**SCREEN:** (popover, listbox) Social platform select.
**Preserve exactly:** Button (brand-colored icon chip + platform name + chevron); `lin-menu` of platforms (brand icon + label + checkmark when selected); select → close + onChange; outside-click + Escape close; `role=listbox`/`option`, `aria-selected`.
**States:** closed / open / active.
**Rules:** Brand-colored icons (TikTok/YouTube/Instagram/Facebook/X); single-select; a11y roles.
**Restyle goal:** Brand-colored icon chips, `lin-menu` dropdown, checkmark on selected, chevron caret.

---

*Generated from the live source (`apps/web/src/pages` + `components`). Re-derive if pages change. Pair every block with the Master prompt (§1) + the matching screenshot + the **Lyra Component Library** design system.*
