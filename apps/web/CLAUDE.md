# @lyra/web (Vite + React)

The workbench SPA. Keep it thin: no business logic in components, server is the source of truth.

## Rules

- Import all DTO/model types from `@lyra/shared`. Don't redefine request/response shapes.
- **Validation lives on the server.** Components do only light inline form checks (required/length); never replicate the api's rules.
- **Auth token strategy:** the access token lives in memory only (never `localStorage`). The refresh token is an httpOnly cookie the browser sends automatically. On load, `AuthContext` calls `/auth/refresh` to silently restore the session.
- Always go through the fetch wrapper in `src/lib/api.ts` — it attaches the Bearer token, sends `credentials: 'include'`, and on a 401 refreshes once then retries. Don't call `fetch` directly for api calls.

## UI / design

- **The UI is LIGHT + Linear-style.** The dark "pure-black canvas / pill CTAs /
  orange glow" spec in `docs/lyra-design-system.md` is **superseded** — do not
  follow it. The live system is:
  - **Tokens:** `src/index.css` `:root` (what components read; full
    `[data-theme=dark]` overrides) + `src/styles/tokens.css` (Tailwind `@theme`
    layer). Always style via `var(--…)` tokens — never hardcode hex/px. Use
    `--ink`/`--ink-muted`, `--surface-1..4`, `--hairline`, `--primary`,
    `--success`/`--warning`/`--danger`, `--accent-*`, `--radius-*`, `--text-*`,
    `--shadow-*`. New status/section colors belong in the token block (and the
    dark block), not inline.
  - **Spec:** [docs/notion-design.md](../../docs/notion-design.md) — the LIVE
    Notion design system (neutral paper + blue `#0075DE`, system UI font, bold
    700 headings, flat components). `lyra-linear-audit.md` is historical
    (superseded). `scripts/figma-mcp.sh` re-pulls specs from the Figma MCP.
  - Blue `#0075DE` is the single accent — brand mark, primary CTA, focus, active.
  - **i18n:** all user-facing copy goes through `t('…')` with keys in
    `src/i18n/locales/{en,vi}/*` — add BOTH locales.
- The `frontend-design` plugin is installed; pair it with `docs/notion-design.md`
  for new screens.

## Build & test

- `vite build` bundles; type-check is separate (`tsc --noEmit`). App tsconfig sets `noEmit` + `declaration: false` (apps don't emit `.d.ts`).
- Tests: Vitest. `src/lib/api.test.ts` mocks `fetch`. React Testing Library for `AuthContext`/forms is planned. `pnpm --filter @lyra/web test`.
