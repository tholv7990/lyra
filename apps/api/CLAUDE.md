# @lyra/api (NestJS)

The only tier that holds keys, crawls, and calls AI providers. Module-per-feature; business logic in services/guards, never controllers.

## Contracts & validation

- DTOs are **class-validator classes that `implements` the shared DTO interface** (e.g. `class SignupBody implements SignupDto`). The `implements` link prevents drift — never redefine a request shape inline.
- Global `ValidationPipe` runs with `{ whitelist: true, transform: true }`.
- Map Mongoose documents to the shared *safe* shapes in services (`UsersService.toSafeUser`). **Never serialize `passwordHash` / `tokenHash` / `encryptedKey`** — they exist only in schemas here.

## Auth & access control

- Access token: JWT `{ sub: userId }` (~15 min). Refresh token: opaque random, **sha256-hashed** at rest, httpOnly/SameSite=strict cookie (path `/auth`), **rotated every refresh**, TTL index. Passwords: **argon2id**.
- Guard order: `JwtAuthGuard` (global, honors `@Public()`) → `WorkspaceGuard` (membership + role + `canManageKeys`) → `ProjectAccessGuard` (visibility). The later guards arrive in Phases 1–2.
- Enforce access with the **shared helpers** (`canViewProject`/`canEditProject`/`canManageKeys`) — don't reimplement the rules.
- **Multi-tenancy:** workspace is NOT in the JWT. Verify membership per request; scope every Mongo query by `workspaceId`.

## Mongo

- CommonJS build (`tsconfig.json` → `module: commonjs`). `autoIndex` is on in dev, **off in production** — manage indexes with migrate-mongo (hosting doc §7).
- Dev DB via `docker compose up -d mongo` (replica set `rs0`, so transactions work).

## Build & test

- `nest build` uses `tsconfig.build.json` (excludes tests). `type-check` uses `tsconfig.json` (includes tests). Don't re-add `incremental` — it breaks `nest start --watch` emit with `deleteOutDir`.
- Unit: Jest `*.spec.ts` under `src` (no DB, mock models). E2e: `test/*.e2e-spec.ts` via supertest against **mongodb-memory-server**. `pnpm --filter @lyra/api test` / `test:e2e`.
