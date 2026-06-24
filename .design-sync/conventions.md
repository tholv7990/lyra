# Lyra component library — how to build with it

These are the real shipped components from the Lyra app (`@lyra/web`). Build with them directly; they render with the Lyra **Notion** design system (warm‑neutral paper, one blue accent `#0075DE`, system UI font, flat with hairlines, full light + dark).

## Setup / wrapping
- **No provider wrapper is required.** Import a component and render it. i18n is initialized inside the bundle, so text components (e.g. `StatusPill`) resolve their labels on their own.
- Light/dark follow `document.documentElement[data-theme]` (`"dark"` for dark mode). Every component reads CSS variables, so theming is automatic — set the attribute on a wrapping element to preview dark.
- These are presentational primitives. They take plain props and callbacks; they do **not** fetch data or read app/router context.

## Styling idiom — token CSS variables + the shipped class system
Style your own layout glue with the design tokens, never hardcoded hex/px. The components themselves already carry their classes from the shipped `styles.css`; you do **not** add utility classes to them (this is not a Tailwind/utility system, and not a style‑via‑props system).

Core token families (defined on `:root`, inverted under `[data-theme="dark"]`):
- **Text:** `--ink` (primary), `--ink-muted`, `--ink-tertiary`, `--placeholder`
- **Surfaces:** `--app-bg`, `--surface-1..4`, `--card`, `--field`, `--hairline`, `--hairline-strong`
- **Brand/semantic:** `--primary`, `--primary-hover`, `--primary-pressed`, `--primary-tint`, `--success`, `--warning`, `--danger`, `--on-accent`
- **Radius / type / elevation:** `--radius-sm|md|lg` (6/8/12px) · `--text-micro|mini|small|normal|large|title3|title2|title1` · `--shadow-sm|md|lg`, `--shadow-popover`
- **Status → token** (use for any status UI you compose): running→`--primary`, awaiting→`--warning`, done→`--success`, error→`--danger`, idle/skipped→`--ink-tertiary`.

Reusable class affordances you can apply to your own buttons: `.btn-primary` (filled blue), `.btn-ghost` (hairline secondary), `.btn-danger` (red), `.btn-inline` (toolbar width), `.text-input` (form field). Canonical icon affordances: view=eye, delete/close=✕, add=＋ (use `IconButton` with `variant="danger"` for delete).

## Where the truth lives
- **`styles.css`** (and its `@import` of `_ds_bundle.css`) — the full token + class system. Read it before styling.
- **Each component's `*.prompt.md` and `*.d.ts`** — usage notes and the exact prop contract.

## Build snippet
```tsx
import { StatusPill, IconButton, Toggle, EmptyState } from '@lyra/web';

function Example() {
  return (
    <section style={{ padding: 24, background: 'var(--app-bg)', color: 'var(--ink)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ font: '700 var(--text-title3)/1.1 inherit', letterSpacing: '-0.02em' }}>Prompts</h2>
        <StatusPill status="public" />
        <IconButton label="New" variant="primary" icon={<PlusIcon />} />
      </header>
      <Toggle checked={true} label="Auto-save" onChange={() => {}} />
      <EmptyState icon={<PromptsIcon />} title="No prompts yet"
        body="Create one or adopt from the marketplace."
        cta={{ label: 'New prompt', onClick: () => {} }} />
    </section>
  );
}
```

## Components in this library
`IconButton` · `MenuPicker` (single-select; never a native `<select>`) · `Avatar` · `Modal` · `ConfirmDialog` · `Toggle` · `Checkbox` · `Tooltip` · `EmptyState` · `StatusPill` · `TagChip` · `ProviderIcon`. These are the standalone primitives; richer app components (run flow, editors, boards) are intentionally not in this library.
