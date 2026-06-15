# @lyra/web (Vite + React)

The workbench SPA. Keep it thin: no business logic in components, server is the source of truth.

## Rules

- Import all DTO/model types from `@lyra/shared`. Don't redefine request/response shapes.
- **Validation lives on the server.** Components do only light inline form checks (required/length); never replicate the api's rules.
- **Auth token strategy:** the access token lives in memory only (never `localStorage`). The refresh token is an httpOnly cookie the browser sends automatically. On load, `AuthContext` calls `/auth/refresh` to silently restore the session.
- Always go through the fetch wrapper in `src/lib/api.ts` — it attaches the Bearer token, sends `credentials: 'include'`, and on a 401 refreshes once then retries. Don't call `fetch` directly for api calls.

## UI / design

- Honor the tokens in [docs/lyra-design-system.md](../../docs/lyra-design-system.md): pure-black canvas, single warm orange accent (`#FF6B1A`), pill CTAs with the orange glow, 18px card radii, Inter with negative display tracking. Orange is scarce — brand mark, primary CTA, focus, active only.
- The `frontend-design` plugin is installed; pair it with the design-system doc for new screens.

## Build & test

- `vite build` bundles; type-check is separate (`tsc --noEmit`). App tsconfig sets `noEmit` + `declaration: false` (apps don't emit `.d.ts`).
- Tests: Vitest. `src/lib/api.test.ts` mocks `fetch`. React Testing Library for `AuthContext`/forms is planned. `pnpm --filter @lyra/web test`.
