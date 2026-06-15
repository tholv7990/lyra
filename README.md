# Lyra

A multi-user web app where teams run an 8-step AI creative pipeline
(find → crawl → brief → insight → prompts → images → video → assemble/QA)
for a brand/product, producing on-brand images and UGC/video.

Turborepo monorepo · TypeScript (strict) · React + Vite (web) · NestJS + Mongoose (api) · `@lyra/shared` (zero-dependency types/enums/constants/utils).

> **Status: Phase 0 complete** — monorepo scaffold + authentication (signup / login / refresh / logout / me).
> See [docs/lyra-requirements.md](docs/lyra-requirements.md) §B8 for the full phase plan and [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Workspace layout

```
apps/
  web/        # Vite + React SPA (the workbench)
  api/        # NestJS + Mongoose REST API
packages/
  shared/     # @lyra/shared — types, enums, constants, pure utils (no runtime deps)
docs/         # product, technical, design-system, and hosting/CI specs
```

## Prerequisites

- **Node 20+** (developed on 24) and **pnpm 10**
- A running **MongoDB** at `MONGODB_URI` (default `mongodb://localhost:27017/lyra`)

## Getting started

```bash
pnpm install

# api environment — copy the example and fill in secrets
cp apps/api/.env.example apps/api/.env

pnpm dev          # runs web (:5173) + api (:3001) together via Turbo
```

## Common commands

```bash
pnpm build        # build all packages (shared builds first)
pnpm type-check   # tsc --noEmit across the workspace
pnpm lint         # eslint across the workspace
pnpm test         # unit tests (shared: vitest, api: jest, web: vitest)

pnpm --filter @lyra/api test:e2e   # auth e2e against in-memory MongoDB
```

## Notes

- The access token lives in memory client-side; the refresh token is a rotated, httpOnly cookie hashed at rest.
- Passwords are hashed with argon2id. Server-only fields never appear in any API response.
- `@lyra/shared` is built dual-format (ESM + CJS) so both the Vite web app and the CommonJS NestJS api consume it cleanly.
