# Linear design-system audit (Figma → Lyra)

> Source: **Linear Design System (Community)** Figma, read live via the Figma Dev Mode
> MCP server (`get_variable_defs` / `get_design_context` / `get_metadata` / `get_screenshot`).
> Lyra stays **light-mode** and keeps its **orange `#FF6B1A`** accent — we match Linear's
> *geometry, spacing, states and elevation*, not its dark surfaces or indigo.
>
> The MCP tools failed to bind in-session (known issue, see SESSION-HANDOFF §1), so the
> specs below were pulled by driving the server's Streamable-HTTP endpoint directly via
> `scripts/figma-mcp.sh` — that bridge works regardless of the in-session binding bug.

## 1. Linear's measured spec (from the Figma)

### Control geometry
| Token | Linear | Lyra (before) |
|---|---|---|
| Button height — Large / Medium / Small / XS | 48 / **32** / 28 / 24 px | `--control-h: 32px` ✓ |
| Button radius | **4 px** | `--radius-control: 6px` |
| Button padding (Medium) | `8px 14px` | `0 14px` + 32px min-height ✓ |
| Input radius | **6 px** | `6px` ✓ |
| Menu-row radius | **6 px** | 7px ✓-ish |
| Menu / card radius | 10–12 px | 10–12px ✓ |
| Checkbox | 14px box, **3px** radius, 1px border | (none) |
| Toggle | 30×20 pill (12px radius), 16px knob | (none) |

### Buttons (hierarchies × states)
- **Primary** — `bg #575BC7`, `1px border #575BC7`, text white **13px / Inter Regular (400)**,
  shadow `Button = 0 1 2 rgba(0,0,0,.09)`. **Hover → lighter fill `#666BE2`** (not darker).
- **Secondary** — `bg #292A35`, **visible `1px border #393A4B`**, text `#EEEFFC` 13/400,
  shadow `Button 2 = 0 1 1 rgba(0,0,0,.15)`.
- **Tertiary** — no bg, no border, text `#D2D3E0` **13px / Medium (500)**, faint shadow.
- **Destructive** — `bg #EB5757`, text white 13/Medium, shadow `Button`; **focus → red glow
  `0 0 12 -1 #EB5757`**.
- **Banner** — text-only accent link ("Try Now →").
- Visible **focus ring** on secondary (indigo border ring) — buttons are keyboard-focusable.

### Inputs
- Field `bg #151621`, `1px border #393A4B`, **radius 6px**, body text `#EEEFFC` 15/400,
  label `#D2D3E0` 13/400, 4px label↔field gap.
- **Focus = border colour → accent `#6C79FF`. No glow ring.** (clean, flat focus)
- Placeholder = muted grey `#858699`.

### Menus / dropdown rows
- Row: `radius 6px`, padding `8px 6px`, text `#D2D3E0` 13px. **Hover = subtle row wash `#26273B`.**

### Elevation ramp (the whole set)
| Effect | Value |
|---|---|
| Button | `0 1 2 rgba(0,0,0,.09)` |
| Button 2 (secondary) | `0 1 1 rgba(0,0,0,.15)` |
| Tooltip | `0 2 4 rgba(0,0,0,.10)` |
| Dropdown | `0 7 32 rgba(0,0,0,.35)` + `0 4 24 rgba(0,0,0,.20)` |
| Command Bar | `0 16 70 rgba(0,0,0,.50)` + background-blur 120 |

Structure to copy: **tight 1–2px shadow on buttons; large, soft, downward-offset blur on
overlays.** (Alphas are high because the file is dark-mode; we drop them for light surfaces.)

### Typography — Inter, **weights 400 / 500 only**
`micro 11 · mini 12 · small 13 · normal 15 (lh 22) · large 18 (lh 28.8) · title3 20 ·
issue 22 · title2 24 · title1 36`. Headings line-height ≈ 1.0 (tight); **letter-spacing 0**.
Body = **15px**. Controls/secondary = 13px. No bold (700); emphasis is Medium (500).

### Tooltip
Dark surface, `0.5px` border, **radius 4px**, padding `8px / 5–7.5px`, text 11px,
shadow `0 2 2 rgba(0,0,0,.10)`; inline key-caps `bg rgba(149,149,189,.13)` radius 3px.

## 2. Gaps & enhancements applied

Kept orange; matched Linear's *structure/states/elevation*.

1. **Elevation ramp** — added light-mode tokens `--shadow-button`, `--shadow-button-strong`,
   `--shadow-popover`, `--shadow-tooltip` (translate Linear's offset/blur growth to light alphas).
2. **Buttons get Linear's "lift"** — `.btn-primary` now pairs the crisp inset edge with
   `--shadow-button`, and lifts on hover; `.btn-danger` lifts too.
3. **Secondary button reads as a real button** — `.btn-ghost` gains a visible hairline border
   + micro-shadow (Linear's bordered soft-fill), instead of a borderless grey wash.
4. **Focus rings (Linear-match + a11y fix)** — `.btn-primary/.btn-ghost/.btn-danger`,
   `.icon-btn`, `.lin-add` now show a `:focus-visible` ring (primary-tint; danger-tint for
   destructive). Previously buttons had **no** keyboard-focus style.
5. **Overlays float like Linear** — `.lin-menu` and `.model-menu` use `--shadow-popover`
   (deeper, softer) instead of the flat `--shadow-md`.
6. **Type-scale tokens** — added `--text-*` / `--lh-*` matching Linear's Inter scale, available
   for components to reference.

### Round 2 — full type + component pass

7. **Button radius → 4px** (`--radius-button`) on `.btn-*`; button font → 13px. Fields/icon
   buttons keep 6px (matches Linear: text buttons 4px, fields 6px).
8. **Body → Linear type** — `15px / line-height 1.47`, near-neutral tracking; headings get a
   tight `line-height` + modest negative tracking app-wide (`h1–h4` base rule), muted page
   descriptions bumped to 15px.
9. **Filter button** — dashed → Linear's **solid** subtle-bordered ghost, hover wash + focus ring.
10. **Filter/type chips** (`.type-chip`) — 980px pills → Linear **rounded-rect segments** (6px,
    28px tall), hover wash, filled active state, focus ring.
11. **Active-filter chip** (`.lin-chip`) radius → 6px; **tag dropdown** (`.tag-suggest`) now
    floats with `--shadow-popover`; **tag input box** radius → 6px.

### Round 3 — tags + list/table (took Linear's components)

Grounded in screenshots from the Figma: the **Label dropdown** ("Change labels…" → checkbox +
colored dot + name rows), the **Label button / label pills** (neutral pill, colour in the dot,
collapses to "N labels"), and the **Issues list** (dense ~44px rows, full-width hover wash,
accent-tinted selection, muted secondary columns).

12. **Tags are now Linear labels** — the chip is a **neutral pill with the colour in the dot**
    (was tinting the whole chip in the tag's hue). Applied everywhere tags render: `TagInput`
    (editable), and the read-only chips on Prompts / Pipelines / PromptPlayground rows + header.
    Chip radius → 6px, dot → 8px.
13. **List/table → Linear list** — row titles lightened to weight 500; keyboard focus is now a
    subtle wash + **left accent bar** (`inset 2px 0 0 var(--primary)`) instead of a hard orange
    outline. Header stays small-uppercase-muted (already matched Linear).

## 3. Deliberate deviations (kept — flagged for decision)

- **Input focus keeps a subtle tint ring** (Linear = border-only). The ring aids visibility on
  white and already uses the accent border Linear specifies.
- **Status/visibility badges stay pills** (`.badge` 980px) — these are status pills, not labels;
  the colored-dot **labels** (`.tag-chip`) now follow Linear (neutral rounded-rect + dot).
- **Tag picker keeps the chips-in-box + type-to-filter model** rather than Linear's pure
  checkbox-toggle list — same building blocks (colored dot + name + count, floating popover),
  fitted to Lyra's inline editor.
- **Indigo / dark surfaces** — intentionally not adopted (orange + light is the brand).

## 4. How to re-pull specs next session

`scripts/figma-mcp.sh <tool> '<json-args>'` drives the Dev Mode MCP server over HTTP.
Useful node ids (Design System page `8:2`): Buttons `14:347`, Input Fields `14:312`,
Toggle/Checkbox `22:938`, Shadows `14:136`, Typography `11:24`, Filters `34:691`,
Command Bar `19:315`, Tooltips `22:2016`. Example:
`bash scripts/figma-mcp.sh get_variable_defs '{"nodeId":"14:347"}'`.
