# Task 4 Report — API: SaveProduct enriches the run's target product

## Commit
`fc45d865` — feat(api): SaveProduct enriches the run's target product (applyResearch)

## Per-file changes

### `apps/api/src/runs/providers/action-provider.interface.ts`
Added `productId?: string` to `ActionRunContext` after `projectId?`, with comment: "a research run targets a product; SaveProduct enriches it".

### `apps/api/src/runs/runs.service.ts`
Added `productId: doc.productId,` to the action `.execute(...)` call site in `executeStep`, so the run's target product ID flows into action context.

### `apps/api/src/runs/providers/save-product.action.ts`
Full rewrite: now guards on `ctx.productId` (not `ctx.projectId`), calls `this.products.applyResearch(ctx.productId, 'system', { evidence, sources, unitEcon, subScores, score, grade, decision })`, returns `productId: ctx.productId` in data. Removed `productName` / `saveResearch` usage.

### `apps/api/src/products/products.service.ts`
Removed the `saveResearch` stub (the deprecated method that threw `'use applyResearch'`). No imports changed — `EvidenceClaim`, `SourceRow`, etc. are still used by `applyResearch`.

### `apps/api/src/runs/runs.service.spec.ts`
Added `describe('SaveProductAction')` block with the brief's TDD test: constructs `SaveProductAction` with a mock `{ applyResearch }`, passes a ctx with `productId: 'p1'` and ledger `data: { score: 80, decision: 'TEST_NOW' }`, asserts `applyResearch` called with `('p1', 'system', expect.objectContaining({ score: 80, decision: 'TEST_NOW' }))`.

### `apps/api/src/runs/providers/save-product.action.spec.ts`
Updated to test the new API: mocks `applyResearch` (not `saveResearch`), passes `productId` on ctx (not `projectId`), verifies `applyResearch` called with `('p1', 'system', objectContaining({...}))`, checks `out.data.productId === 'p1'`. "no product" branch now uses `productId: undefined` (was `projectId`).

### `apps/api/src/runs/research-chain.spec.ts`
Added `productId: 'prod-1'` to the run context factory. Changed mock from `{ saveResearch }` to `{ applyResearch }`. Updated assertion index: `applyResearch.mock.calls[0][2]` (3-arg call: productId, actorId, payload) instead of `saveResearch.mock.calls[0][3]` (4-arg: projectId, workspaceId, actorId, payload).

## Full api test + type-check + build output

### `pnpm --filter @lyra/shared build`
```
CJS ⚡️ Build success in 20ms
ESM ⚡️ Build success in 20ms
DTS ⚡️ Build success in 386ms
```

### `pnpm --filter @lyra/api type-check`
Clean — no output (exit 0).

### `pnpm --filter @lyra/api test`
```
Test Suites: 59 passed, 59 total
Tests:       302 passed, 302 total
Snapshots:   0 total
Time:        10.997 s
```

### `pnpm --filter @lyra/api build`
Clean — no output (exit 0).

---

# Task 4 Security Fix Report — workspaceId fence (IDOR)

## Summary

Fixed cross-workspace IDOR: Product and product-run service methods now include `workspaceId` in all Mongo query filters, so a member of workspace A cannot access workspace B's products by guessing an id.

## Per-file changes

### `apps/api/src/products/products.service.ts`
- `get(id, workspaceId)` — added `workspaceId` param; query filter is now `{ _id: id, workspaceId, active: { $ne: false } }`.
- `update(id, workspaceId, actorId, dto)` — added `workspaceId` param; filter includes `workspaceId`.
- `remove(id, workspaceId, actorId)` — added `workspaceId` param; filter includes `workspaceId`.
- `applyResearch(productId, workspaceId, actorId, p)` — added `workspaceId` param; filter includes `workspaceId`.

### `apps/api/src/products/products.controller.ts`
- `get`: now extracts `@Param('id') ws` and calls `products.get(productId, ws)`.
- `update`: now extracts `@Param('id') ws` and calls `products.update(productId, ws, user.id, body)`.
- `remove`: now extracts `@Param('id') ws` and calls `products.remove(productId, ws, user.id)`.

### `apps/api/src/runs/runs.service.ts`
- `listForProduct(productId, workspaceId)` — added `workspaceId` param; filter is now `{ productId, workspaceId, active: { $ne: false } }`.

### `apps/api/src/runs/runs.controller.ts`
- `createProductRun`: calls `this.products.get(productId, ws)` (workspace-fenced) before building the run.
- `listProductRuns`: calls `this.runs.listForProduct(productId, ws)`.

### `apps/api/src/runs/providers/save-product.action.ts`
- Calls `this.products.applyResearch(ctx.productId, ctx.workspaceId, 'system', {...})` — passes `ctx.workspaceId` as the new second argument.

### `apps/api/src/products/products.service.spec.ts`
- Restored `create` tests: blank-name rejection + default field values (Candidate status, empty images/tags/competitorIds).
- Restored `remove` test: soft-delete verified with workspace filter.
- Added workspace-fence test: `get('p1', 'ws-OTHER')` when `findOne` returns null throws `NotFoundException`; confirms `workspaceId` is in the query filter.
- Updated `applyResearch` test: now asserts filter includes `workspaceId: 'ws-1'`.

### `apps/api/src/runs/providers/save-product.action.spec.ts`
Updated `toHaveBeenCalledWith` to include `workspaceId` as 2nd arg: `('p1', 'ws', 'system', objectContaining({...}))`.

### `apps/api/src/runs/runs.service.spec.ts`
Updated `SaveProductAction` block assertion to include `workspaceId` as 2nd arg.

### `apps/api/src/runs/research-chain.spec.ts`
Updated arg index: `applyResearch.mock.calls[0][3]` (payload is now at index 3 with the new 4-arg signature).

## Full gate output

### `pnpm --filter @lyra/shared build`
Clean — ESM/CJS/DTS build success.

### `pnpm --filter @lyra/api type-check`
Clean — no output (exit 0).

### `pnpm --filter @lyra/api test`
```
Test Suites: 59 passed, 59 total
Tests:       306 passed, 306 total
Snapshots:   0 total
Time:        11.525 s
```

### `pnpm --filter @lyra/api build`
Clean — no output (exit 0).
