# design-sync NOTES — @lyra/web (Lyra Component Library)

Repo-specific gotchas for future syncs. Read before re-syncing.

## Shape & entry
- `@lyra/web` is a **Vite app**, not a published component library: no `dist/`, no `.d.ts` exports, no Storybook. We sync in **synth-entry** mode via a hand-authored barrel `apps/web/.ds-entry.tsx` passed as `--entry`. The barrel re-exports the scoped primitives and `import './src/i18n'` so `useTranslation()` components (StatusPill) render without a provider wrapper.
- `PKG_DIR` resolves to `apps/web` because the barrel lives there (walk-up finds `apps/web/package.json` → name `@lyra/web`). So `cfg.srcDir`, `cfg.tsconfig`, `cfg.cssEntry`, and `componentSrcMap` are all **`apps/web`-relative**.
- Build command (run from repo root):
  `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules apps/web/node_modules --entry apps/web/.ds-entry.tsx --out ./ds-bundle`
- `--node-modules apps/web/node_modules` (pnpm symlinks resolve react + @lyra/shared there).

## CSS
- Component classes (`icon-button`, `menupick-*`, `badge status-*`, `dialog-scrim`, `prompt-empty`, `tag-chip`, …) live in `src/layout/layout.css`, NOT `index.css`. The app loads CSS via JS imports, so there is no single stylesheet whose `@import` closure covers everything.
- `cfg.cssEntry` = `apps/web/.ds-styles.css`, a **concatenation** of `src/index.css` + `src/layout/layout.css` (regenerate with: `cd apps/web && cat src/index.css src/layout/layout.css > .ds-styles.css`). It must stay self-contained (no `@import` of un-uploaded files). All app CSS is plain (no Tailwind `@apply`/`@theme`/`@tailwind`), so a raw concat is faithful; `index.css :root` already defines every `--*` token (tokens.css/Tailwind not needed).
- **Re-sync risk:** `.ds-styles.css` is a static copy — if `index.css`/`layout.css` change, re-cat it before building or styles go stale.

## Playwright
- Chromium **build 1228** is cached at `%LOCALAPPDATA%/ms-playwright`. Install `playwright@1.61.1` (pins exactly 1228) in `.ds-sync` for the render check — `npm i playwright@1.61.1` inside `.ds-sync`.

## Known render warns (triaged benign — do not re-chase)
- `[RENDER_THIN] IconButton` and `[RENDER_THIN] ProviderIcon`: both are **icon-only** components (no text by design). The heuristic flags "no text"; the contact sheet confirms the icons paint correctly (eye/＋/✕ and the colored provider badges). Benign.
- `[FONT_MISSING] "JetBrains Mono"`: `layout.css` names JetBrains Mono for code blocks but the app ships no webfont (system-font design). The app itself falls back to system monospace, so the substitute is **intended**, not a defect. Accepted — do not wire `cfg.extraFonts`.

## Scope
- Synced set = 12 standalone presentational primitives (IconButton, MenuPicker, Avatar, Modal, ConfirmDialog, Toggle, Checkbox, Tooltip, EmptyState, StatusPill, TagChip, ProviderIcon).
- **Deliberately excluded** (context-coupled: react-router / react-query / run-context / API calls): RunFlow, FlowPager, EditorShell, ChatPane, Composer, ProductBoard, ProductDetail, Board, CommandBar, and the API-backed modals. Authorable later only if decoupled or given the right `cfg.provider` chain.

## Re-sync risks
- Static `.ds-styles.css` copy (see CSS).
- ProviderIcon preview passes provider as string literals (`'anthropic' as never`) to avoid a cross-package `@lyra/shared` enum import; still valid (string enum values).
- No `.d.ts` → `<Name>Props` come from the synth scan of src; a component prop rename re-keys its source and re-verifies (expected).
