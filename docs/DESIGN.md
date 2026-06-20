# Lyra component system (DESIGN.md)

> Single source of truth for the UI building blocks. The app is **light + Linear-style**,
> token-only, one orange accent (`#FF6B1A`). This catalogs what already exists, maps it to
> Linear's design system, and names the gaps/duplication to fix — so every page composes the
> **same** components instead of re-rolling them.
>
> Companion docs: [lyra-linear-audit.md](lyra-linear-audit.md) (Linear specs measured from the
> Figma) · [lyra-design-system-actions.md](lyra-design-system-actions.md) (enforceable rules).

## Principles

1. **Harvest, don't rebuild.** ~70% of the system already exists as CSS primitives + React
   components. The work is to **document, consolidate duplication, and fill gaps** — not to
   start a second system.
2. **Token-only.** Style only via `var(--…)` from `src/index.css` `:root` (full
   `[data-theme=dark]` override). Never hardcode hex/px. New colors → a token, not inline.
3. **Match Linear's geometry/states/elevation**, keep light + orange (not indigo/dark).
4. **Every interactive component ships all states:** default · hover · focus-visible · active ·
   disabled · loading · error. Skeletons over spinners. Empty states that teach.
5. **i18n every string** (`t('…')`, en + vi). **Tests** use `renderToStaticMarkup` (no RTL/jsdom,
   no Storybook) — so the "library" is **CSS primitives + thin React wrappers + an in-app gallery**,
   not Storybook.

## Foundations — tokens (`src/index.css`) ✅ solid

| Group | Tokens |
|---|---|
| Surfaces | `--app-bg --canvas --card --field --surface-1..4 --surface-hover` |
| Ink | `--ink --ink-muted --ink-tertiary --placeholder --on-accent` |
| Lines | `--hairline --hairline-strong` |
| Brand/state | `--primary(/-hover/-pressed/-tint) --success --warning --danger(/-tint/-wash) --info` |
| Section accents | `--accent-{projects,prompts,pipelines,chats,marketplace,import,publish,members,keys}` |
| Radius | `--radius-{button:4,control:6,sm,md,lg}` |
| Shadow | `--shadow-{sm,md,lg,button,button-strong,popover,tooltip}` |
| Type | `--text-{micro,mini,small,normal,large,title1..3}` · `--lh-{tight,body}` |
| Control | `--control-h:32` · `--focus-ring` · `--focus-ring-danger` |

Matches Linear's ramp (button 4px radius, 32px control, the elevation set). **Keep.**

## Component catalog

Status: ✅ solid · 🔧 exists but consolidate · ⚠️ gap (build it)

### Primitives

| Component | Today | Linear ref | Status |
|---|---|---|---|
| **Button** | `.btn-primary/.btn-ghost/.btn-danger` + sizes `.btn-lg/.btn-sm/.btn-xs` + `.btn-inline` | 32px / 4px radius / Inter 13 | 🔧 add a thin `<Button variant size>` so pages stop hand-writing classes + inline overrides |
| **AI button** | `.btn-ai` (+ `.btn-lg`) — primary-tint fill, primary border+text, `SparkleIcon`; the "Build with AI" / "Edit with AI" affordance (Pipelines list toolbar + builder toolbar) | tinted control, 32/40px | ✅ |
| **IconButton** | `IconButton` (variants: default/primary/danger/success · sizes sm/md/lg · `boxed` = hairline border + surface fill, used by the topbar bell), `.icon-btn(-success/-danger)` | — | ✅ |
| **Input / Textarea** | `.text-input`, `.field`, `.project-input` | radius 6, border-accent focus | ✅ |
| **Checkbox** | — | 14px box, 3px radius, 1px border | ⚠️ gap |
| **Toggle / Switch** | `.pw-toggle` (one-off) | 30×20 pill, 16px knob | ⚠️ gap (general one) |
| **Segmented / Radio** | `.seg/.seg-btn` | — | ✅ |
| **Badge / Pill** | `.badge.status-*`, `ProviderBadge` | status pills | ✅ |
| **Label chip** | `.tag-chip + .tdot`, `labelColor()` | neutral pill + colored dot | ✅ |
| **Avatar** | `avatarStyle()/initial()`, `.prow-updated-icon` | — | ✅ |
| **Icons** | `icons.tsx`, `TaskStatusIcon`, `TaskPriorityIcon`, `ProviderIcon` | status circles / priority bars | ✅ |
| **Tooltip** | — | dark, 4px radius, 11px | ⚠️ gap |
| **Toast** | — (only the notification bell) | — | ⚠️ gap |
| **Skeleton** | `.skel-line` | — | ✅ |
| **Kbd** | inline in `LabelPicker` | — | 🔧 extract |

### Composite

| Component | Today | Status |
|---|---|---|
| **Menu / Dropdown** | `.lin-menu/.lin-menu-item` + `useOutsideClick` | ✅ |
| **Picker** (trigger → menu) | `ModelPicker`, `TypeSelect`, `PromptPicker`, `LabelPicker`, `TaskStatusPicker`, `TaskPriorityPicker`, + inline assignee picker | 🔧 **6+ near-copies** → generalize one `<Picker>` (icon+label trigger, searchable menu, single/multi) |
| **Modal / Dialog** | `.dialog/.field` (AddKey, Confirm, MoveToTeam, RequestProvider/TeamUpgrade, SaveAsPrompt, BuildWithAi) | 🔧 **3 families** — unify on one `<Dialog>` shell |
| **Drawer / Sheet** | `.drawer-scrim` (RunVariablesModal) | 🔧 fold into the Dialog/Drawer set |
| **Bespoke panels** | `StepTestModal`, `StepResultModal` | 🔧 reconcile with Dialog |
| **ConfirmDialog** | `ConfirmDialog` | ✅ |
| **Empty state** | `EmptyState`, `.prompt-empty` | ✅ |
| **Filter popover** | Prompts/Marketplace filter | ✅ |
| **Tag editor** | `TagInput`, `LabelPicker` | ✅ |

### Layout / shell

| Component | Today | Status |
|---|---|---|
| **Page shell** | `EditorShell` (back · title · actions · body; mobile = nav, desktop = breadcrumb) + `EditorActions` | ✅ |
| **Card + grid** | `.lib-card/.lib-grid`, `ProviderCard` | ✅ |
| **List + Row** | `.row/.row.clickable`, `.trow` + grouped `.tgroup`/`.tlist` | ✅ |
| **Section header** | `.section-head` | ✅ |
| **Toolbar** | `.lin-toolbar` | ✅ |
| **Breadcrumb / Topbar / FAB** | layout shell (topbar = floating rounded bar; FAB = bottom-right AI launcher) | ✅ |
| **Sidebar / menu** | active item = left orange pill (`.nav-item.active::before`) + bold weight; grouped labels (`.nav-group-label`); user footer (`.sidebar-user`) = tinted avatar + identity + inline logout `IconButton`; collapses to a 64px icon rail | ✅ |
| **Home hero** | `.home-hero` — greeting + `.home-ws-meta` (avatar chip · workspace type · role pill) + actions (New project ghost / Start a chat primary) | ✅ |
| **Hub tile** | `.panel` in `.panel-grid`; `.panel-top` = section icon + count/status `.badge`; `.panel-attn` = soft orange ring when a provider key is missing; `.panel-soon` = dashed "coming soon" | ✅ |
| **Onboarding checklist** | `.gs-card` — leading icon, progress bar, collapsible; each `.gs-step` is active/done with a labeled CTA (`btn-primary/ghost btn-sm`) or a Done marker | ✅ |

### Domain (composed — leave as-is)

`TaskList` (kanban board) · Project/Prompt/Pipeline cards · `RunFlow`/`RunStepCard`/`RunSummary` ·
`FlowCanvas`/`FlowPager` · `StepCard` (builder node) · `Composer` · `Markdown` · `PromptCodeBlock` · `SavedResults`.

### Gallery + page patterns (reuse, don't re-roll)

- **Card gallery** (`marketplace.css` `.mkt-head/.mkt-toolbar/.mkt-search/.mkt-filter/.mkt-meta/.mkt-grid/.mkt-card/.mkt-card-foot/.mkt-by/.mkt-card-actions/.mkt-pager`) — shared by Marketplace, Prompts, **Pipelines** (`.pl-*`), **Projects** (`.pr-*`). Page-specific bits only in the page's own css.
- **Projects list** (`projects.css` `.pr-card/.pr-vars/.pr-var/.pr-stats/.pr-open`) — `{key} value` variable chips, a tasks·shared stat row, primary `.pr-open`. `Project.taskCount` (shared model; active-task aggregate in `ProjectsService.toViews`) feeds the count.
- **Project detail** (`projects.css` `.pd/.pd-context/.pd-meta/.pd-vars`) — context strip over a **task board** (`tasks.css` `.tboard/.tcol/.tcard`): status columns (New/In progress/On hold/Complete), per-column add (create + move).
- **Project editor** (`projecteditor.css` `.pe-*`) — title helper, `{key}=value` rows + quick-add chips, **Status toggle switch** (`.pe-toggle`), **Visibility cards + member picker** (`.pe-vis-card/.pe-member`, wired to `shared`/`sharedWith`).
- **Publish** (`publish.css` `.pub-*`) — 2-col composer: channel selector cards, caption card with `#`/`{product}` insert + count, media thumbs, review-gate footer, live preview panel.
- **Editor shell**: `EditorShell` (back · title · actions · scrolling body) for every editor/detail/workbench.

## The fix list (priority order)

1. **Generalize `<Picker>`** — collapse the 6+ trigger→menu pickers into one (status/priority/
   assignee/label/model/type are all the same shape). Biggest consistency + dedupe win.
2. **Unify modals** — one `<Dialog>` (+ `<Drawer>` variant); migrate the 3 families onto it.
3. **Fill gaps** — `<Checkbox>`, `<Toggle>`, `<Tooltip>`, `<Toast>` (Linear specs in the audit).
4. **`<Button>` wrapper** — thin React component over the existing classes (kills the inline
   `style={{width:auto…}}`-style overrides; `.btn-inline` was a band-aid).
5. **`/components` gallery** — a dev-only route rendering every component at real tokens (our
   Storybook substitute, RTL-free).

## Linear gaps to spec from the Figma

The audit already has buttons/inputs/menus/shadows/type. Still to pull (Dev Mode MCP, on the
**Linear Design System (Community)** file): **Checkbox** (14/3px), **Toggle** (30×20/16 knob),
**Tooltip** (dark/4px/11px). Drive via `scripts/figma-mcp.sh get_design_context '{"nodeId":"…"}'`.

## Next

Build the fix list top-down; refactor each page onto the consolidated components as we go (the
project → task → pipeline surface is already the furthest along: status/priority/label all use
the shared pieces).
