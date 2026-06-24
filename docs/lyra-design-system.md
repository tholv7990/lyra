# Lyra Design System (Notion)

> **This is the LIVE design system.** Warm‑neutral paper canvas, one confident **blue** accent (`#0075DE`), system UI font, flat surfaces with hairlines (not heavy shadows), full dark mode.
>
> **Source of truth = code.** Token values mirror `apps/web/src/index.css` `:root` + `[data-theme='dark']` (also exposed to Tailwind via `apps/web/src/styles/tokens.css`). If this doc and `index.css` ever disagree, **`index.css` wins** — re‑sync from it. Design‑language narrative: `docs/notion-design.md`.
>
> **History:** earlier versions of this file held a dark/Apple spec and a Linear/orange (`#FF6B1A`) spec — both **superseded** and kept only in git history. `docs/lyra-linear-audit.md` is likewise historical.
>
> **Golden rule:** style **only** via `var(--…)` tokens — never hardcode a hex or px. New status/section colors go in the token block (light **and** dark), not inline.

---

## 1. Foundations

**Font.** Platform UI font — no webfont.
`--font-sans: -apple-system, BlinkMacSystemFont, ui-sans-serif, 'Segoe UI', Helvetica, 'Apple Color Emoji', Arial, sans-serif`

**Body.** `--text-normal` (16px), line‑height `--lh-body` (1.5), tracking `-0.006em`, antialiased, color `--ink` on `--app-bg`.

**Headings.** `h1–h4` are weight **700**, line‑height `--lh-tight` (1.1), tracking `-0.02em` app‑wide (component rules may override).

**Accent.** Blue `#0075DE` is the **single** accent — brand mark, primary CTA, focus ring, active state. No second structural accent (the per‑section `--accent-*` hues are for Home hub tiles only).

**Control geometry.** One language: height `--control-h` **32px**, radius `--radius-button`/`--radius-control` **6px**, used by buttons, inputs, selects so they line up. Size modifiers: Large 40 / Small 28 / XS 24.

---

## 2. Color tokens

### Neutrals & surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--app-bg` | `#ffffff` | `#191919` | App background (body) |
| `--canvas` | `#ffffff` | `#1f1f1f` | Legacy main canvas |
| `--surface-1` | `#f6f5f4` | `#202020` | Warm paper — sidebar, nested/hover surfaces |
| `--surface-2` | `#efedea` | `#2c2c2c` | Hover surface |
| `--surface-3` | `#e6e3df` | `#373737` | Active/pressed surface |
| `--surface-4` | _(n/a)_ | `#434343` | Deepest surface (dark only) |
| `--card` | `#ffffff` | `#252525` | Cards, dialogs, panels |
| `--field` | `#ffffff` | `#1c1c1c` | Inputs |
| `--surface-hover` | `rgba(0,0,0,.04)` | `rgba(255,255,255,.06)` | Row / menu‑item / soft‑button hover wash |
| `--hairline` | `rgba(55,53,47,.09)` | `rgba(255,255,255,.094)` | 1px borders & dividers |
| `--hairline-strong` | `rgba(55,53,47,.16)` | `rgba(255,255,255,.16)` | Hover/focus borders, input borders |
| `--disabled-bg` | `#e8e8ea` | `#26262d` | Disabled control fill |
| `--disabled-ink` | `rgba(60,60,67,.4)` | `rgba(235,235,245,.3)` | Disabled control text |

### Text (ink)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#31302e` | `#ededeb` | Primary text (warm near‑black) |
| `--ink-muted` | `#615d59` | `#9b9894` | Secondary text |
| `--ink-tertiary` | `#75726b` | `#7a7670` | Tertiary, group labels, field hints |
| `--placeholder` | `#918d86` | `#6f6c66` | Input placeholder |

### Brand & semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `#0075de` | `#2383e2` | Brand / CTA / active |
| `--primary-hover` | `#2383e2` | `#3b91e8` | CTA hover |
| `--primary-pressed` | `#005bab` | `#0075de` | CTA pressed |
| `--primary-tint` | `rgba(0,117,222,.12)` | `rgba(35,131,226,.22)` | Tint bg, badges, focus ring |
| `--success` | `#0f9d58` | `#2eb872` | Positive / done |
| `--warning` | `#dd5b00` | `#e9a23b` | Warning / awaiting |
| `--danger` | `#e03e3e` | `#ff6369` | Destructive / error |
| `--info` | `#0075de` | `#529cca` | Info (toast dot) |
| `--on-accent` | `#ffffff` | `#ffffff` | Text/icon on any filled accent |
| `--danger-tint` | `#f1c9c9` | `#5a2a2c` | Inline error border |
| `--danger-wash` | `#fdf1f1` | `#2a1618` | Inline error background |

### Code block (theme‑independent — dark in both themes)

`--code-bg #1d1f23` · `--code-ink #e6e6e6` · `--code-ink-muted #cfcfcf`

### Section accents (Home hub tiles + get‑started checklist only)

`--accent-chats #f59e0b` · `--accent-prompts #14b8a6` · `--accent-pipelines #0075de` · `--accent-projects #0ea5e9` · `--accent-keys #7c5cff` · `--accent-members #ec4899` · `--accent-marketplace #10b981` · `--accent-import #0891b2` · `--accent-publish #f43f5e`

### Mapping app states → tokens

- Run/step status: `running` → `--primary` · `awaiting_gate`/`waiting` → `--warning` · `done` → `--success` · `error` → `--danger` · `idle`/`skipped`/`queued` → `--ink-tertiary`.
- Product decision pill: `TEST_NOW` → `--success` · `RESOLVE_GAPS`/`LOW_COST_VALIDATION` → `--warning` · `PARK` → `--ink-muted` · `REJECT` → `--danger`.
- Toast: info `--info` · success `--success` · error `--danger`.

---

## 3. Radius, elevation, focus

**Radius:** `--radius-sm 6px` · `--radius-md 8px` · `--radius-lg 12px` · `--radius-control 6px` · `--radius-button 6px`. (Cards/auth use 12–14px; controls 6px.)

**Shadows** (flat, layered, soft — deepen in dark):
| Token | Light value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(16,17,26,.04), 0 1px 3px rgba(16,17,26,.03)` | Cards at rest, toggle knob |
| `--shadow-md` | `0 1px 2px rgba(16,17,26,.04), 0 8px 24px rgba(16,17,26,.07)` | Card hover |
| `--shadow-lg` | `0 1px 2px rgba(16,17,26,.05), 0 16px 40px rgba(16,17,26,.1)` | Modals / large overlays |
| `--shadow-button` | `0 1px 2px rgba(16,17,26,.08)` | Button lift |
| `--shadow-button-strong` | `0 1px 2px rgba(16,17,26,.1), 0 2px 6px rgba(16,17,26,.08)` | Stronger button |
| `--shadow-tooltip` | `0 2px 4px rgba(16,17,26,.12), 0 4px 12px rgba(16,17,26,.1)` | Tooltip |
| `--shadow-popover` | `0 0 0 1px …, 0 8px 24px …, 0 16px 48px …` | Dropdowns, toasts |

**Scrim:** `--scrim rgba(0,0,0,.35)` behind modals/drawers.

**Focus ring:** `--focus-ring: 0 0 0 3px var(--primary-tint)` (danger: `--focus-ring-danger`). Every focusable control reuses it on `:focus-visible`.

**Motion:** transitions ~`0.12s ease`; everything collapses under `@media (prefers-reduced-motion: reduce)`.

---

## 4. Type scale

| Token | Size | Typical use |
|---|---|---|
| `--text-micro` | 11px | Tooltip, smallest captions |
| `--text-mini` | 12px | Eyebrow, dividers, tiny labels |
| `--text-small` | 13px | Secondary/control text, field labels |
| `--text-normal` | 16px | Body (lh 1.5, tracking ‑0.006em) |
| `--text-large` | 18px | Emphasis |
| `--text-title3` | 20px | Feature titles |
| `--text-issue` | 22px | Detail‑page headers (task/project/issue) |
| `--text-title2` | 24px | Section subheads |
| `--text-title1` | 36px | Page headings |

Line‑height tokens: `--lh-body 1.5`, `--lh-tight 1.1`.

**Spacing:** 8px base; common steps 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 32 / 48px. Card‑grid gap 14px; page padding 28px (16px ≤480px).

---

## 5. Component recipes (real classes)

Use these classes — don't re‑roll. (Geometry/colors come from the tokens above.)

**Buttons** — `.btn-primary` (filled blue, full‑width + 6px top‑margin by default; add `.btn-inline` for toolbar use) · `.btn-ghost` (card bg + `--hairline-strong` border, soft hover) · `.btn-danger` (filled red). Sizes: `.btn-lg` (40) · `.btn-sm` (28) · `.btn-xs` (24). Disabled → `--disabled-bg`/`--disabled-ink`. Focus → `--focus-ring`.

**Text input** — `.text-input`: full‑width, `--field` bg, `1px --hairline-strong`, `--radius-control`, `8px 11px` padding. Focus → border `--primary` + `--focus-ring`. Field anatomy: `.field` wrapper, `.field-req` (red `*`), `.field-msg` (hint, `--ink-tertiary`) / `.field-msg.err` + `.field-invalid` (red). Password: `.pw-wrap` + `.pw-toggle` (eye).

**Select** — never native. Use the **MenuPicker** component for every single‑select dropdown (`.text-input` select styling exists only for legacy/auth selects).

**Checkbox** `.cbx` (+ `.cbx-box`) — 14px box, checked fills `--primary`. **Toggle** `.tgl` (+ `.tgl-track`/`.tgl-knob`) — 30×20 track, checked `--primary`, knob slides 10px.

**Avatar** `.avatar` — round initials chip; size + color set inline; text `--on-accent`.

**Tooltip** `.tip-wrap` + `.tip` — `--ink` bg, `--app-bg` text, `--shadow-tooltip`, appears above on hover/focus.

**Toast** `.toast` (+ `.toast-dot`, `.toast-success`/`.toast-error`, `.toast-msg`, `.toast-x`) — card surface, `--shadow-popover`.

**Cards / grid** — `.lib-grid` (`grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap:14px`) + `.lib-card` (16px padding, `--card` bg, `1px --hairline`, `--radius-lg`, hover lifts to `--shadow-md`).

**Inline messages** — `.error` (red 13px), `.notice` (green 13px), `.muted` (`--ink-muted`).

**Shared React primitives** (in `apps/web/src/components/`): `MenuPicker` (mandatory dropdown), `LabelPicker` (tags + inline create), `IconButton` (`variant` default/primary/danger/success · `size` sm/md/lg · `label` required), `Modal` + `ConfirmDialog` (X close top‑right, `danger` = red confirm), `EmptyState`, `EditorShell` (full‑page editor; hides app topbar + AI FAB), `PromptCodeBlock`, `ProviderIcon`, `Avatar`, `RunFlow`/`FlowPager`, `PromptPicker`.

---

## 6. Affordances (same action, same icon, everywhere)

| Action | Control | Icon |
|---|---|---|
| View / preview | `IconButton` | **Eye** |
| Open / go to detail | `IconButton` | entity icon |
| Delete / remove | `IconButton variant="danger"` | **X** |
| Close modal/drawer | `IconButton` | **X** (top‑right) |
| Add / new | `IconButton variant="primary"` or `.btn-primary` | **Plus** |
| Confirm / save / run | `.btn-primary` (labeled) | — |
| Cancel | `.btn-ghost` "Cancel" | — |

Irreversible actions in a dialog use a **labeled** `.btn-danger`, never a bare icon. Icons live in `apps/web/src/layout/icons.tsx`.

---

## 7. App shell & layout

- **Sidebar** 248px (collapses to 64px icon rail; drawer ≤600px), `--surface-1` bg; brand row + nav groups (`.nav-item`, active = `--surface-2` + 3px `--primary` left bar) + workspace switcher + user footer.
- **Topbar** 52px, **frosted** (translucent `--card` + `backdrop-filter: blur`), sticky; breadcrumb + title + actions.
- **Content** max‑width 1240px centered; padding 28px top/sides, 48px bottom; only the main column scrolls.
- **AI FAB** 48px circular `--primary`, fixed bottom‑right 24px (16px mobile), `--shadow-lg`; hidden on editor/builder pages.
- **Modal** `.dialog-scrim` (`--scrim`, z‑100) + `.dialog` (max‑width ~380px so it fits a 390px viewport, `--card`, `--shadow-lg`, X top‑right).
- **Auth** pages: fixed frosted `.auth-topbar` (theme + language toggle), `.auth-card` (max 360px), matrix‑rain backdrop.

---

## 8. Dark mode & responsive

- **Dark mode** is first‑class: same token names, dark values; every component flips via `<html data-theme="dark">` (set pre‑paint in `index.html`, managed by `src/lib/prefs.ts`). Design and check both themes.
- **Breakpoints:** ≤600px mobile (single column, drawer sidebar, hamburger, full‑width CTAs) · 600–820px tablet (2‑up grids) · ≥821px desktop.
- **Mobile rules:** verify **~390px**, not just desktop. Use `minmax(0,1fr)` — **never `repeat(N,1fr)`** (overflows phones). Watch `order:-1` pushing forms off‑screen. iOS: controls forced to 16px ≤820px to stop zoom‑on‑focus. Editors go full‑viewport (`100dvh`) via EditorShell; builders use **FlowPager** (one step at a time).
- **a11y:** honor `prefers-reduced-motion`; `.sr-only` for landmark headings; `IconButton` requires a `label`.

---

## 9. Do / Don't

**Do:** style via tokens; reuse the shared components (MenuPicker for ALL dropdowns); one blue accent; hairlines over shadows; system font; bold‑tight headings; map enum states to the status tokens (§2); route all copy through `t('…')` with **both** `en` + `vi` locales; design dark + mobile.

**Don't:** hardcode hex/px; use native `<select>`; add a second structural accent; roll bespoke dialogs/controls; invent a status not in an enum; let a `repeat(N,1fr)` grid overflow mobile; put new colors inline instead of in the token block.

---

_Re‑sync this file from `apps/web/src/index.css` whenever tokens change. Last synced from `index.css` on 2026‑06‑24._
