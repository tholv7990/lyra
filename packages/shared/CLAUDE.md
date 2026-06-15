# @lyra/shared

The single source of truth for types, enums, constants, and pure logic shared by `apps/api` and `apps/web`.

## Hard rules

- **ZERO runtime dependencies.** Never add a runtime dep. Only types, enums, constants, and pure functions live here. No validation library (no class-validator/zod) — DTOs are plain **interfaces**; the api validates them.
- **No server-only fields.** `passwordHash`, `encryptedKey`, `tokenHash` never appear here. Models are the *safe transport shapes* the api returns and the web consumes (e.g. `ApiKeyInfo` exposes `last4`, never the key).
- **`id`s are `string`** (serialized Mongo ObjectId). Dates are ISO `string`.
- Everything is re-exported from `src/index.ts`. Keep the barrel exports complete.

## Layout

`src/enums` · `src/models` · `src/constants/steps.ts` (`STEP_DEFS`, `STEP_PROVIDERS`) · `src/dto` (interfaces only) · `src/utils` (`canViewProject`, `canEditProject`, `canManageKeys`, `fillPrompt`).

## Build & test

- Built **dual-format (ESM + CJS)** via tsup (`tsup.config.ts`) so the Vite web app (ESM) and the CommonJS NestJS api (CJS) both consume it cleanly. The `exports` map in `package.json` routes `import`→`dist/index.js`, `require`→`dist/index.cjs`.
- After changing a type/enum/DTO, the apps need the rebuilt output: `pnpm --filter @lyra/shared build` (turbo's `^build` does this automatically for `build`/`type-check`/`test`).
- Add Vitest unit tests for every pure helper — they're cheap and high-value. `pnpm --filter @lyra/shared test`.
