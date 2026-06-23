# Product Pool Phase 2 — Fix Report

Date: 2026-06-23

## Files changed

### `apps/web/src/components/ProjectProducts.tsx`

**Fix 1 (UX) — Pool picker excluded copies**

Before computing `selectedPoolIds`, the full `pool` list (which includes project
copies returned by `productsApi.list()`) was used directly. Copies have
`poolProductId` and/or `projectId` set; they must never appear as selectable pool
entries in the picker.

Change: introduced `truePool = pool.filter((p) => !p.poolProductId && !p.projectId)`
and derived `availablePool` from `truePool` instead of `pool`.

---

### `apps/api/src/products/products.service.ts`

**Fix 2 (Correctness) — niche/description included in drift detection and refresh**

`driftsFrom`: widened both param types to include `niche?: string` and
`description?: string`; added two comparisons:
```
|| (copy.niche ?? '') !== (pool.niche ?? '')
|| (copy.description ?? '') !== (pool.description ?? '')
```

`refreshCopy`: added re-snapshot of `niche` and `description` after the existing
field assignments. Per-brand fields (`price`, `compareAtPrice`, `offer`, `status`)
are deliberately not touched.

**Fix 3 (Defense-in-depth) — workspace-scoped pool reads**

`refreshCopy` pool lookup: added `workspaceId` and `projectId: { $exists: false }`
to the `findOne` filter.

`listForProject` batch pool fetch: added `workspaceId` to the `find` filter.

---

### `apps/api/src/products/project-products.service.spec.ts`

Added a new `describe` block `ProductsService drift + refresh` with one test:

- Verifies `listForProject` marks `drift = true` when pool `niche` differs from copy.
- Verifies `refreshCopy` re-snapshots `niche` and `description` from the pool.
- Verifies `refreshCopy` does NOT overwrite per-brand `price` / `compareAtPrice`.

---

## Gate results

```
pnpm --filter @lyra/shared build       ✓  (28.24 KB CJS / 24.52 KB ESM)
pnpm --filter @lyra/api type-check     ✓  (no errors)
pnpm --filter @lyra/api test           ✓  312/312 passed
pnpm --filter @lyra/web type-check     ✓  (no errors)
pnpm --filter @lyra/web test           ✓  91/91 passed
pnpm --filter @lyra/web build          ✓  (built in 373ms; chunk-size warning is pre-existing)
```

## Commit hash

See git log on branch `feat/product-pool-phase2`.
