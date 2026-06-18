# Lyra UI consistency rules (actions, tokens, reusable components)

The enforceable rules behind a consistent UI. New web code MUST follow these.
Companion to `docs/lyra-linear-audit.md` (the Linear visual spec).

## 1. No hardcoded CSS values — use tokens

Never write a raw color / font-size / radius / shadow where a token exists.
Tokens live in `apps/web/src/index.css :root` (+ the `[data-theme=dark]` block):

- **Color:** `--ink`, `--ink-muted`, `--ink-tertiary`, `--surface-1..4`, `--field`,
  `--card`, `--hairline`, `--hairline-strong`, `--primary`(+`-hover/-pressed/-tint`),
  `--success`, `--warning`, `--danger`, `--info`, `--accent-*`. For a tint, use
  `color-mix(in srgb, var(--token) N%, transparent)` — not a baked `rgba()`.
- **Type:** `--text-micro`(11) `--text-mini`(12) `--text-small`(13)
  `--text-normal`(15) `--text-large`(18) `--text-title3`(20) `--text-title2`(24)
  `--text-title1`(36). No fractional off-scale sizes (10.5/12.5/13.5/14.5…).
- **Radius:** `--radius-sm`(6) `--radius-md`(8) `--radius-lg`(12) `--radius-control`(6)
  `--radius-button`(4).
- **Shadow:** `--shadow-sm/md/lg/button/button-strong/popover/tooltip`.

Inline `style={{}}` is allowed only for genuinely dynamic values (a computed
label color, a progress-bar width). Static styling belongs in CSS via tokens.

## 2. Reuse components — don't hand-roll a new one

Prefer the shared component over bespoke markup:

| Need | Use | Not |
|---|---|---|
| Icon-only button | `<IconButton icon label variant size>` | a new `<button><Icon/></button>` + new CSS class |
| Empty list state | `<EmptyState icon title body cta>` | inline `.prompt-empty` markup |
| Confirm destructive action | `<ConfirmDialog>` | a new dialog |
| Tag / label editing | `<LabelPicker>` | — |
| Model selection | `<ModelPicker>` | — |

To build still: a shared `<Modal>` (10 dialogs re-implement backdrop/escape) and
`<InlineEdit>` (3 classes — `.prow-edit`, `.lin-title-input`, `.prow-title-input`
— do the same row-rename). Until then, match the existing patterns; don't add a 4th.

## 3. Same action = same control, everywhere

Canonical action affordances (icons from `apps/web/src/layout/icons.tsx`):

| Action | Control | Icon |
|---|---|---|
| **View / preview** | `IconButton` | `EyeIcon` |
| **Open / go to detail** | `IconButton` | the entity icon (Projects/Pipelines/…) |
| **Delete / remove** (inline / row / settings) | `IconButton variant="danger"` | `XIcon` |
| **Close** (modal/drawer) | `IconButton` | `XIcon` |
| **Add / new / create** | `IconButton variant="primary"` or `.btn-primary` | `PlusIcon` |
| **Confirm / save** | `.btn-primary` (text) | — |
| **Cancel** (in a dialog) | `.btn-ghost` (text "Cancel") | — |
| **Run** | `.btn-primary` (text) | — |

**Deliberate exception:** inside a **confirmation dialog**, the destructive action
stays a *labeled* text button ("Delete"/"Remove" via `.btn-danger`) — an
unlabeled icon for an irreversible action in a confirm step is worse UX. The X /
trash-vs-X consistency rule applies to inline/row/settings controls, not the
labeled confirm button in the modal that follows.

Text buttons: `.btn-primary` (one orange CTA), `.btn-ghost` (secondary),
`.btn-danger` (destructive, labeled). Sizes `.btn-lg/.btn-sm/.btn-xs`.

## Status (June 19, 2026)
Done: delete = X everywhere (Settings Trash→X); modal close = X (StepResultModal
glyph→X); row action icons unified to neutral+token (only delete is colored);
semantic colors tokenized (+`--info`); `IconButton` + `EmptyState` shipped and in
use. Remaining: migrate the grid-coupled `.prow-*` row buttons through
`IconButton` (needs mobile visual check), build `<Modal>`/`<InlineEdit>`, finish
the long-tail font-size/radius/spacing token sweep.
