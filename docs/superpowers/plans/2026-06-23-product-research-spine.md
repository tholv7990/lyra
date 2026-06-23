# Product-research v1 — deterministic spine (Product entity + shared types + pure functions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cheap, fully-testable deterministic spine of the product-research feature — the `Product` entity (project-owned), the evidence/economics/scoring types + pure functions in `@lyra/shared`, and cascade cleanup — with **no LLM, no pipeline, no web-research provider** (those are later slices).

**Architecture:** Net-new types/enums/constants/pure-functions in `@lyra/shared` (zero runtime deps, Vitest), then a `Product` NestJS module that mirrors the existing `Task` module shape (schema/service/controller/views/dto under `/workspaces/:id/projects/:projectId/products`, reusing `ProjectAccessGuard`), then a cascade extension so deleting a Project/Workspace soft-deletes its Products. This is build-sequence #1 from the spec (`docs/specs/2026-06-22-lyra-v3-research-creative-loop.md` §6).

**Tech Stack:** `@lyra/shared` (tsup dual-format, Vitest), NestJS 10 + Mongoose (Jest), class-validator DTOs that `implements` shared interfaces. No new dependency.

## Global Constraints (copied from spec + project invariants)
- **Product is PROJECT-OWNED** (`projectId` on Product, like `Task`) — decided 2026-06-23. No workspace catalog, no copies, no drift/refresh.
- `@lyra/shared` has **ZERO runtime deps** — only types, enums, constants, pure functions. Everything re-exported from `src/index.ts`.
- DTOs are **class-validator classes that `implements` the shared DTO interface** (invariant 2). DTO *interfaces* live in `@lyra/shared/dto`.
- **Workspace-scoped queries** (invariant 5); access via `ProjectAccessGuard` (invariant 4) — no new access logic. Mutations add `@RequireCreate()`.
- **Server-only fields never leave the api** (invariant 3); views are safe transport shapes (`toProductView`).
- Soft-delete + audited like every collection (`AuditedEntity`, `active: { $ne: false }` filters).
- **All math/scoring/gating is pure code in `@lyra/shared`** (invariant 1) — never an LLM.
- TypeScript strict. TDD. Per-task LOCAL commits. Explicit `git add <paths>` — **never `-A`** (a Codex agent shares the tree). After any shared change: `pnpm --filter @lyra/shared build` before api type-check (worktree stale-dist gotcha).

## Scope (what this plan does NOT include — later slices)
- The agentic web-research provider (search→fetch→reflect) — build-sequence #2, the risky net-new build. Separate plan.
- The v1 research-pipeline template (assemble the §1C.1 steps) — needs the provider **and** new engine "CODE step" support. Separate plan.
- `resolveInputs()` (pipeline step 1) and `runScenarios()` (sensitivity bands) — deferred to the pipeline plan because their input shapes / deltas aren't pinned in the spec. This plan ships the fully-specified core: `computeUnitEcon`, `weightedScore`, `gradeConfidence`, `decide`.
- `Run.productId?` / `Task.productId?` / `PublishedPost.productId?` / monitor `productId` link — additive, wired per loop stage later (spec §4 DEFER).

## Assumptions baked into this plan (flagged — pure + tested, so trivially adjustable later)
- `gradeConfidence`: "independent sources" = distinct `sourceId` count; A = a purchase-data claim **and** ≥3 sources, B = ≥3 sources, C = 2, D = ≤1. Requires a new `purchaseData?: boolean` flag on `EvidenceClaim` to mark direct sales signals (Amazon Movers, TikTok Shop).
- `decide` gate→decision map: safety/IP/misleading-claims/negative-unit-econ → `REJECT`; cpaExceedsMaxCac → `RESOLVE_GAPS`; singleSourceDemand → `LOW_COST_VALIDATION`. Score bands (no gates): ≥75 `TEST_NOW`, ≥60 `RESOLVE_GAPS`, ≥45 `LOW_COST_VALIDATION`, else `PARK`.

---

## Task 1: shared — research types, ProductStatus enum, WEIGHTS + SubScores

**Files:**
- Modify: `packages/shared/src/enums/index.ts`
- Modify: `packages/shared/src/models/index.ts`
- Create: `packages/shared/src/constants/research.ts`
- Modify: `packages/shared/src/dto/index.ts`
- Modify: `packages/shared/src/index.ts` (barrel: add the new constants file)

**Interfaces (Produces):** `ProductStatus` enum; `ConfidenceKind`, `EvidenceClaim`, `SourceRow`, `UnitEconInputs`, `UnitEcon`, `ConfidenceGrade`, `HardGates`, `Decision`, `ProductEconInputs`, `Product` types; `WEIGHTS` const + `ScoreKey` + `SubScores`; `CreateProductDto` / `UpdateProductDto` interfaces.

- [ ] **Step 1: `ProductStatus` enum** — append to `packages/shared/src/enums/index.ts`:
```ts
// Product lifecycle (manual board state, like TaskStatus — no metric auto-advances it).
export enum ProductStatus {
  Candidate = 'candidate',
  Validating = 'validating',
  Testing = 'testing',
  Scaling = 'scaling',
  Declining = 'declining',
  Killed = 'killed',
}
```

- [ ] **Step 2: `WEIGHTS` + score types** — create `packages/shared/src/constants/research.ts` (WEIGHTS is the single source of truth; the score keys derive from it):
```ts
// The 100-point opportunity model (spec §1E). Sums to 100. The single source of
// truth for the scoring sub-dimensions — ScoreKey/SubScores derive from it.
export const WEIGHTS = {
  demandIntent: 15,
  trendDurability: 10,
  problemIntensity: 10,
  whitespace: 12,
  unitEconomics: 18,
  creativePotential: 10,
  channelFit: 7,
  supplyQuality: 8,
  riskCompliance: 5,
  expansionValue: 5,
} as const;

export type ScoreKey = keyof typeof WEIGHTS;
export type SubScores = Record<ScoreKey, number>; // each 0..5 (grounded LLM sub-score)
```

- [ ] **Step 3: research + Product types** — append to `packages/shared/src/models/index.ts`. (At the top of the file, add `import type { SubScores } from '../constants/research';` next to its existing imports, and ensure `ProductStatus` + `UserRef` are importable — `UserRef` is already defined in this file; import `ProductStatus` from `../enums`.)
```ts
// ── Product research: evidence ledger (spec §1B) ───────────────────────────
export type ConfidenceKind = 'verified' | 'calculated' | 'estimate' | 'assumption';

export interface EvidenceClaim {
  id: string;
  statement: string;          // "90-day search interest up ~40% in US"
  value?: number | string;
  kind: ConfidenceKind;
  sourceId: string;           // -> SourceRow.id (required for verified/calculated)
  geography?: string;
  period?: string;
  demandSignal?: boolean;     // counts toward the >=3-independent-signals rule
  purchaseData?: boolean;     // direct sales signal (Amazon Movers, TikTok Shop) → grade A
}

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  accessDate: string;         // ISO; stamped by the fetch step, not the LLM
  geography?: string;
  metric?: string;
  primary: boolean;           // first-party vs specialist
  reliabilityNote?: string;
  alive: boolean;             // set false by the dead-link sweep
}

// ── Unit economics (spec §1D) ──────────────────────────────────────────────
export interface UnitEconInputs {
  aov: number;
  landedCost: number;
  paymentFeePct: number;
  fulfillment: number;
  shippingSubsidy: number;
  expectedReturnLossPct: number;
  warrantyReservePct: number;
  desiredPostAdCmPct: number;
}
export interface UnitEcon {
  cm1: number;
  cm1Pct: number;
  breakEvenRoas: number;      // 1 / cm1Pct (Infinity when cm1Pct <= 0)
  maxCac: number;             // aov * (cm1Pct - desiredPostAdCmPct)
  targetRoas: number;         // aov / maxCac (Infinity when maxCac <= 0)
}

// ── Scoring / grading / decision (spec §1E) ────────────────────────────────
export type ConfidenceGrade = 'A' | 'B' | 'C' | 'D';
export interface HardGates {
  unresolvedSafety: boolean;
  materialIpRisk: boolean;
  negativeUnitEcon: boolean;
  cpaExceedsMaxCac: boolean;
  singleSourceDemand: boolean;
  misleadingClaimsRequired: boolean;
}
export type Decision = 'TEST_NOW' | 'RESOLVE_GAPS' | 'LOW_COST_VALIDATION' | 'PARK' | 'REJECT';

// ── Product (project-owned durable opportunity; spec §4) ───────────────────
export interface ProductEconInputs {
  targetPrice?: number;
  testingBudget?: number;
  inventoryBudget?: number;
  minPreAdCmPct?: number;
  desiredPostAdCmPct?: number;
}
export interface ProductSource {
  platform?: string;          // e.g. aliexpress / amazon / tiktok
  url?: string;
}
export interface Product {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  source?: ProductSource;
  niche?: string;
  category?: string;
  status: ProductStatus;
  // research outputs — written by the future Save step; empty/undefined in v1
  evidence: EvidenceClaim[];
  sources: SourceRow[];
  unitEcon?: UnitEcon;
  subScores?: SubScores;
  score?: number;             // 0..100
  grade?: ConfidenceGrade;
  decision?: Decision;
  // product-level economics inputs (spec §4)
  econInputs?: ProductEconInputs;
  competitorIds: string[];    // monitor Competitor ids that fed this product
  outcome?: string;           // manual "did it sell?" first-party ground truth
  tags: string[];
  active: boolean;
  createdBy: UserRef;
  updatedBy: UserRef;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: DTO interfaces** — append to `packages/shared/src/dto/index.ts` (import `ProductStatus` from `../enums` and the `ProductSource`/`ProductEconInputs` types from `../models` at the top as needed). v1 exposes only the human-editable fields; research outputs are written by the pipeline, not this form:
```ts
export interface CreateProductDto {
  name: string;
  description?: string;
  source?: ProductSource;
  niche?: string;
  category?: string;
  status?: ProductStatus;
  econInputs?: ProductEconInputs;
  competitorIds?: string[];
  outcome?: string;
  tags?: string[];
}
export interface UpdateProductDto {
  name?: string;
  description?: string;
  source?: ProductSource;
  niche?: string;
  category?: string;
  status?: ProductStatus;
  econInputs?: ProductEconInputs;
  competitorIds?: string[];
  outcome?: string;
  tags?: string[];
}
```

- [ ] **Step 5: barrel** — in `packages/shared/src/index.ts`, add `export * from './constants/research';` (after the other `./constants/*` lines).

- [ ] **Step 6: build + type-check shared** — `pnpm --filter @lyra/shared build` (must succeed; this also surfaces any circular type import). No new test yet (types/const only — the assert that WEIGHTS sums to 100 is covered in Task 2's test).

- [ ] **Step 7: Commit** —
```bash
git add packages/shared/src/enums/index.ts packages/shared/src/models/index.ts packages/shared/src/constants/research.ts packages/shared/src/dto/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): Product entity + research evidence/economics/scoring types"
```

---

## Task 2: shared — money-math, scoring, grading, decision pure functions + Vitest

**Files:**
- Create: `packages/shared/src/utils/research.ts`
- Modify: `packages/shared/src/utils/index.ts` (re-export the new file)
- Test: `packages/shared/src/utils/research.test.ts`

**Interfaces:**
- Consumes: `UnitEconInputs`, `UnitEcon`, `EvidenceClaim`, `ConfidenceGrade`, `HardGates`, `Decision` (`../models`); `WEIGHTS`, `SubScores` (`../constants/research`).
- Produces: `computeUnitEcon(i): UnitEcon`; `weightedScore(s): number`; `gradeConfidence(evidence): ConfidenceGrade`; `decide(score, gates): Decision`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/utils/research.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeUnitEcon, weightedScore, gradeConfidence, decide } from './research';
import { WEIGHTS } from '../constants/research';
import type { SubScores, EvidenceClaim, HardGates } from '../index';

const noGates: HardGates = {
  unresolvedSafety: false, materialIpRisk: false, negativeUnitEcon: false,
  cpaExceedsMaxCac: false, singleSourceDemand: false, misleadingClaimsRequired: false,
};

describe('WEIGHTS', () => {
  it('sums to 100', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('computeUnitEcon', () => {
  it('computes cm1, break-even, max CAC, target ROAS', () => {
    const r = computeUnitEcon({
      aov: 50, landedCost: 12, paymentFeePct: 0.03, fulfillment: 4,
      shippingSubsidy: 2, expectedReturnLossPct: 0.05, warrantyReservePct: 0,
      desiredPostAdCmPct: 0.15,
    });
    // variable = 12 + 1.5 + 4 + 2 + 2.5 + 0 = 22 ; cm1 = 28 ; cm1Pct = 0.56
    expect(r.cm1).toBeCloseTo(28, 6);
    expect(r.cm1Pct).toBeCloseTo(0.56, 6);
    expect(r.breakEvenRoas).toBeCloseTo(1 / 0.56, 6);
    expect(r.maxCac).toBeCloseTo(50 * (0.56 - 0.15), 6); // 20.5
    expect(r.targetRoas).toBeCloseTo(50 / 20.5, 6);
  });
  it('guards negative unit economics (Infinity, not NaN)', () => {
    const r = computeUnitEcon({
      aov: 10, landedCost: 20, paymentFeePct: 0, fulfillment: 0,
      shippingSubsidy: 0, expectedReturnLossPct: 0, warrantyReservePct: 0,
      desiredPostAdCmPct: 0.1,
    });
    expect(r.cm1).toBe(-10);
    expect(r.breakEvenRoas).toBe(Infinity);
    expect(r.targetRoas).toBe(Infinity);
  });
});

describe('weightedScore', () => {
  it('all 5s → 100; all 0s → 0; clamps out-of-range', () => {
    const all = (n: number) => Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, n])) as SubScores;
    expect(weightedScore(all(5))).toBeCloseTo(100, 6);
    expect(weightedScore(all(0))).toBe(0);
    expect(weightedScore(all(99))).toBeCloseTo(100, 6); // clamp to 5
  });
});

describe('gradeConfidence', () => {
  const claim = (sourceId: string, purchaseData = false): EvidenceClaim =>
    ({ id: sourceId, statement: 's', kind: 'verified', sourceId, purchaseData });
  it('A: purchase data + >=3 sources', () => {
    expect(gradeConfidence([claim('a', true), claim('b'), claim('c')])).toBe('A');
  });
  it('B: >=3 sources, no purchase data', () => {
    expect(gradeConfidence([claim('a'), claim('b'), claim('c')])).toBe('B');
  });
  it('C: exactly 2 sources', () => {
    expect(gradeConfidence([claim('a'), claim('b')])).toBe('C');
  });
  it('D: <=1 source', () => {
    expect(gradeConfidence([claim('a')])).toBe('D');
    expect(gradeConfidence([])).toBe('D');
  });
});

describe('decide', () => {
  it('hard gates override score', () => {
    expect(decide(99, { ...noGates, unresolvedSafety: true })).toBe('REJECT');
    expect(decide(99, { ...noGates, negativeUnitEcon: true })).toBe('REJECT');
    expect(decide(99, { ...noGates, cpaExceedsMaxCac: true })).toBe('RESOLVE_GAPS');
    expect(decide(99, { ...noGates, singleSourceDemand: true })).toBe('LOW_COST_VALIDATION');
  });
  it('score bands when no gates', () => {
    expect(decide(80, noGates)).toBe('TEST_NOW');
    expect(decide(65, noGates)).toBe('RESOLVE_GAPS');
    expect(decide(50, noGates)).toBe('LOW_COST_VALIDATION');
    expect(decide(20, noGates)).toBe('PARK');
  });
});
```

- [ ] **Step 2: Run — FAIL** — `pnpm --filter @lyra/shared test -- research`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `packages/shared/src/utils/research.ts`:
```ts
import type {
  UnitEconInputs, UnitEcon, EvidenceClaim, ConfidenceGrade, HardGates, Decision,
} from '../models';
import { WEIGHTS, type SubScores } from '../constants/research';

// CM1 and the derived ad-efficiency thresholds (spec §1D). The LLM supplies the
// tagged cost inputs; ALL arithmetic is here. Percentages are fractions of AOV.
export function computeUnitEcon(i: UnitEconInputs): UnitEcon {
  const aov = i.aov;
  const variableCosts =
    i.landedCost +
    aov * i.paymentFeePct +
    i.fulfillment +
    i.shippingSubsidy +
    aov * i.expectedReturnLossPct +
    aov * i.warrantyReservePct;
  const cm1 = aov - variableCosts;
  const cm1Pct = aov > 0 ? cm1 / aov : 0;
  const breakEvenRoas = cm1Pct > 0 ? 1 / cm1Pct : Infinity;
  const maxCac = aov * (cm1Pct - i.desiredPostAdCmPct);
  const targetRoas = maxCac > 0 ? aov / maxCac : Infinity;
  return { cm1, cm1Pct, breakEvenRoas, maxCac, targetRoas };
}

// Weighted 0..100 total from the 0..5 sub-scores (spec §1E). Out-of-range sub-scores
// are clamped to [0,5] so a bad LLM extraction can't blow past 100.
export function weightedScore(s: SubScores): number {
  let total = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const sub = Math.max(0, Math.min(5, s[k] ?? 0));
    total += WEIGHTS[k] * (sub / 5);
  }
  return total;
}

// Confidence grade from the evidence set (spec §1E). "Independent sources" = distinct
// sourceId; grade A also requires a direct purchase-data claim.
export function gradeConfidence(evidence: EvidenceClaim[]): ConfidenceGrade {
  const sources = new Set(evidence.filter((c) => c.sourceId).map((c) => c.sourceId));
  const n = sources.size;
  const hasPurchaseData = evidence.some((c) => c.purchaseData);
  if (hasPurchaseData && n >= 3) return 'A';
  if (n >= 3) return 'B';
  if (n === 2) return 'C';
  return 'D';
}

// Final decision (spec §1E). Hard gates override the score bands: legal/ethical/
// economics dealbreakers fail outright; thin-but-fixable issues route to a cheaper
// path. With no gates, the weighted score picks the band.
export function decide(score: number, gates: HardGates): Decision {
  if (gates.unresolvedSafety || gates.materialIpRisk || gates.misleadingClaimsRequired) return 'REJECT';
  if (gates.negativeUnitEcon) return 'REJECT';
  if (gates.cpaExceedsMaxCac) return 'RESOLVE_GAPS';
  if (gates.singleSourceDemand) return 'LOW_COST_VALIDATION';
  if (score >= 75) return 'TEST_NOW';
  if (score >= 60) return 'RESOLVE_GAPS';
  if (score >= 45) return 'LOW_COST_VALIDATION';
  return 'PARK';
}
```

- [ ] **Step 4: re-export** — in `packages/shared/src/utils/index.ts`, add `export * from './research';` (top or bottom, matching the file's style).

- [ ] **Step 5: Run — PASS + build** — `pnpm --filter @lyra/shared test -- research` then `pnpm --filter @lyra/shared build`.

- [ ] **Step 6: Commit** —
```bash
git add packages/shared/src/utils/research.ts packages/shared/src/utils/index.ts packages/shared/src/utils/research.test.ts
git commit -m "feat(shared): unit-econ + scoring/grading/decision pure functions"
```

---

## Task 3: api — Product module (mirrors Task) + register

**Files:**
- Create: `apps/api/src/products/product.schema.ts`
- Create: `apps/api/src/products/product.views.ts`
- Create: `apps/api/src/products/dto/products.dto.ts`
- Create: `apps/api/src/products/products.service.ts`
- Create: `apps/api/src/products/products.controller.ts`
- Create: `apps/api/src/products/products.module.ts`
- Create (test): `apps/api/src/products/products.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `ProductsModule`)

**Interfaces:**
- Consumes: shared `Product`/`CreateProductDto`/`UpdateProductDto`/`ProductStatus` (Task 1); `ProjectAccessGuard`, `ProjectsService`, `RequireCreate`, `UsersService`, `AuditedEntity` (existing).
- Produces: REST under `/workspaces/:id/projects/:projectId/products` (the controller uses bare `projects/:id/products/...` paths like `TasksController`; the workspace prefix comes from the global controller mounting — match `TasksController` exactly).

- [ ] **Step 1: Schema** — `apps/api/src/products/product.schema.ts` (mirror `task.schema.ts`; research-output fields are `Mixed`/typed Mongoose subdocs stored as-is, defaulted empty):
```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductStatus } from '@lyra/shared';
import type {
  EvidenceClaim, SourceRow, UnitEcon, SubScores, ConfidenceGrade, Decision,
  ProductEconInputs, ProductSource,
} from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type ProductDocument = HydratedDocument<Product>;

// A durable researched opportunity, owned by ONE project (peer of Task). Holds the
// evidence ledger + economics + score/grade/decision the research pipeline writes,
// plus a manual lifecycle status and first-party outcome note.
@Schema({ timestamps: true })
export class Product extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: Object })
  source?: ProductSource;

  @Prop()
  niche?: string;

  @Prop()
  category?: string;

  @Prop({
    required: true,
    enum: Object.values(ProductStatus),
    default: ProductStatus.Candidate,
    index: true,
  })
  status!: ProductStatus;

  // research outputs (written by the future Save step; empty in v1)
  @Prop({ type: [Object], default: [] })
  evidence!: EvidenceClaim[];

  @Prop({ type: [Object], default: [] })
  sources!: SourceRow[];

  @Prop({ type: Object })
  unitEcon?: UnitEcon;

  @Prop({ type: Object })
  subScores?: SubScores;

  @Prop()
  score?: number;

  @Prop()
  grade?: ConfidenceGrade;

  @Prop()
  decision?: Decision;

  @Prop({ type: Object })
  econInputs?: ProductEconInputs;

  @Prop({ type: [String], default: [] })
  competitorIds!: string[];

  @Prop()
  outcome?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ projectId: 1, createdAt: -1 });
```

- [ ] **Step 2: View** — `apps/api/src/products/product.views.ts` (mirror `task.views.ts`; map all fields to the safe `Product` shape):
```ts
import { ProductStatus, type Product as ProductView, type UserRef } from '@lyra/shared';
import type { ProductDocument } from './product.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

export function toProductView(d: ProductDocument, refs: Map<string, UserRef>): ProductView {
  return {
    id: d._id.toString(),
    workspaceId: d.workspaceId,
    projectId: d.projectId,
    name: d.name,
    description: d.description ?? '',
    source: d.source,
    niche: d.niche,
    category: d.category,
    status: d.status ?? ProductStatus.Candidate,
    evidence: d.evidence ?? [],
    sources: d.sources ?? [],
    unitEcon: d.unitEcon,
    subScores: d.subScores,
    score: d.score,
    grade: d.grade,
    decision: d.decision,
    econInputs: d.econInputs,
    competitorIds: d.competitorIds ?? [],
    outcome: d.outcome,
    tags: d.tags ?? [],
    active: d.active ?? true,
    createdBy: userRef(d.createdBy, refs),
    updatedBy: userRef(d.updatedBy, refs),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
}
```

- [ ] **Step 3: DTO classes** — `apps/api/src/products/dto/products.dto.ts` (class-validator, `implements` the shared interfaces). Use a nested class for `source`/`econInputs` with `@ValidateNested` + `@Type`:
```ts
import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '@lyra/shared';
import type { CreateProductDto, UpdateProductDto, ProductSource, ProductEconInputs } from '@lyra/shared';

class ProductSourceBody implements ProductSource {
  @IsOptional() @IsString() @MaxLength(60) platform?: string;
  @IsOptional() @IsString() @MaxLength(2000) url?: string;
}
class ProductEconInputsBody implements ProductEconInputs {
  @IsOptional() @IsNumber() targetPrice?: number;
  @IsOptional() @IsNumber() testingBudget?: number;
  @IsOptional() @IsNumber() inventoryBudget?: number;
  @IsOptional() @IsNumber() minPreAdCmPct?: number;
  @IsOptional() @IsNumber() desiredPostAdCmPct?: number;
}

export class CreateProductBody implements CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => ProductSourceBody) source?: ProductSourceBody;
  @IsOptional() @IsString() @MaxLength(120) niche?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @ValidateNested() @Type(() => ProductEconInputsBody) econInputs?: ProductEconInputsBody;
  @IsOptional() @IsArray() @IsString({ each: true }) competitorIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateProductBody implements UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => ProductSourceBody) source?: ProductSourceBody;
  @IsOptional() @IsString() @MaxLength(120) niche?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @ValidateNested() @Type(() => ProductEconInputsBody) econInputs?: ProductEconInputsBody;
  @IsOptional() @IsArray() @IsString({ each: true }) competitorIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
```

- [ ] **Step 4: Service** — `apps/api/src/products/products.service.ts` (mirror `TasksService` CRUD; no run-summary aggregation — Products don't roll up runs in v1):
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductStatus,
  type CreateProductDto, type UpdateProductDto, type Product as ProductView,
} from '@lyra/shared';
import { Product, ProductDocument } from './product.schema';
import { UsersService } from '../users/users.service';
import { toProductView } from './product.views';

const MAX_NAME = 160;
const MAX_DESC = 4000;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly model: Model<Product>,
    private readonly users: UsersService,
  ) {}

  async list(projectId: string): Promise<ProductView[]> {
    const docs = await this.model
      .find({ projectId, active: { $ne: false } })
      .sort({ createdAt: -1 })
      .exec();
    return this.toViews(docs);
  }

  async create(projectId: string, workspaceId: string, actorId: string, dto: CreateProductDto): Promise<ProductView> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('A product name is required.');
    const doc = await this.model.create({
      workspaceId,
      projectId,
      name: name.slice(0, MAX_NAME),
      description: (dto.description ?? '').trim().slice(0, MAX_DESC),
      status: dto.status ?? ProductStatus.Candidate,
      ...(dto.source ? { source: dto.source } : {}),
      ...(dto.niche ? { niche: dto.niche } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.econInputs ? { econInputs: dto.econInputs } : {}),
      ...(dto.outcome ? { outcome: dto.outcome } : {}),
      competitorIds: dto.competitorIds ?? [],
      tags: dto.tags ?? [],
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.toView(doc);
  }

  async get(id: string): Promise<ProductView> {
    const doc = await this.model.findOne({ _id: id, active: { $ne: false } }).exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  async update(id: string, actorId: string, dto: UpdateProductDto): Promise<ProductView> {
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (dto.name !== undefined) set.name = dto.name.trim().slice(0, MAX_NAME);
    if (dto.description !== undefined) set.description = dto.description.trim().slice(0, MAX_DESC);
    if (dto.source !== undefined) set.source = dto.source;
    if (dto.niche !== undefined) set.niche = dto.niche;
    if (dto.category !== undefined) set.category = dto.category;
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.econInputs !== undefined) set.econInputs = dto.econInputs;
    if (dto.competitorIds !== undefined) set.competitorIds = dto.competitorIds;
    if (dto.outcome !== undefined) set.outcome = dto.outcome;
    if (dto.tags !== undefined) set.tags = dto.tags;

    const doc = await this.model
      .findOneAndUpdate({ _id: id, active: { $ne: false } }, { $set: set }, { returnDocument: 'after' })
      .exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  async remove(id: string, actorId: string): Promise<void> {
    await this.model
      .findOneAndUpdate({ _id: id, active: { $ne: false } }, { $set: { active: false, updatedBy: actorId } })
      .exec();
  }

  private async toView(doc: ProductDocument): Promise<ProductView> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toProductView(doc, refs);
  }

  private async toViews(docs: ProductDocument[]): Promise<ProductView[]> {
    const refs = await this.users.refMap(docs.flatMap((d) => [d.createdBy, d.updatedBy]));
    return docs.map((d) => toProductView(d, refs));
  }
}
```

- [ ] **Step 5: Controller** — `apps/api/src/products/products.controller.ts` (mirror `TasksController` exactly — same guard, same `projects/:id/...` bare paths, `@RequireCreate()` on mutations):
```ts
import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import type { Product, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { ProjectsService } from '../projects/projects.service';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { ProductsService } from './products.service';
import { CreateProductBody, UpdateProductBody } from './dto/products.dto';

// Products live under a project (peer of Task). ProjectAccessGuard enforces view;
// mutations add @RequireCreate (not Viewer + verified email).
@Controller()
@UseGuards(ProjectAccessGuard)
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('projects/:id/products')
  list(@Param('id') projectId: string): Promise<Product[]> {
    return this.products.list(projectId);
  }

  @Post('projects/:id/products')
  @RequireCreate()
  async create(@Param('id') projectId: string, @Body() body: CreateProductBody, @CurrentUser() user: User): Promise<Product> {
    const project = await this.projects.findActiveById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return this.products.create(projectId, project.workspaceId, user.id, body);
  }

  @Get('projects/:id/products/:productId')
  get(@Param('productId') productId: string): Promise<Product> {
    return this.products.get(productId);
  }

  @Patch('projects/:id/products/:productId')
  @RequireCreate()
  update(@Param('productId') productId: string, @Body() body: UpdateProductBody, @CurrentUser() user: User): Promise<Product> {
    return this.products.update(productId, user.id, body);
  }

  @Delete('projects/:id/products/:productId')
  @RequireCreate()
  @HttpCode(204)
  async remove(@Param('productId') productId: string, @CurrentUser() user: User): Promise<void> {
    await this.products.remove(productId, user.id);
  }
}
```

- [ ] **Step 6: Module** — `apps/api/src/products/products.module.ts` (mirror `TasksModule`; no `Run` model needed — Products don't aggregate runs in v1):
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';

// Products = a project's durable researched opportunities (peer of Task). ProjectsModule
// provides the access guard + project lookup; WorkspacesModule provides the create-gate
// guard deps; UsersModule expands actor refs.
@Module({
  imports: [
    ProjectsModule,
    WorkspacesModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

- [ ] **Step 7: Register** — in `apps/api/src/app.module.ts`, add `import { ProductsModule } from './products/products.module';` near the `TasksModule` import, and add `ProductsModule,` to the `imports:` array next to `TasksModule`.

- [ ] **Step 8: Service unit spec** — `apps/api/src/products/products.service.spec.ts` (mirror the shape of `tasks.service.spec.ts`; mock the Mongoose model + UsersService). Cover: create rejects a blank name; create persists with defaults (status Candidate, empty arrays); remove soft-deletes (`active:false`). Read `apps/api/src/tasks/tasks.service.spec.ts` first to match the existing mocking style, then write the equivalent for `ProductsService`.

- [ ] **Step 9: Build + verify** — `pnpm --filter @lyra/shared build` then:
```bash
pnpm --filter @lyra/api run type-check
pnpm --filter @lyra/api exec jest products.service
pnpm --filter @lyra/api build
```
All green. (The build/boot is the real DI check — a guarded module must import the module exporting the guard's deps; `ProjectsModule` + `WorkspacesModule` cover `ProjectAccessGuard` + the create-gate, matching `TasksModule`.)

- [ ] **Step 10: Commit** —
```bash
git add apps/api/src/products/ apps/api/src/app.module.ts
git commit -m "feat(api): Product module (project-owned, mirrors Task) + register"
```

---

## Task 4: api — cascade soft-delete Products on project/workspace delete

**Files:**
- Modify: `apps/api/src/common/database/cascade.service.ts`
- Modify: `apps/api/src/common/database/cascade.module.ts`

**Interfaces:** Consumes the `Product` schema (Task 3). Extends `CascadeService.deleteProject` + `deleteWorkspace`.

- [ ] **Step 1: Register the model** — in `cascade.module.ts`, add `import { Product, ProductSchema } from '../../products/product.schema';` and add `{ name: Product.name, schema: ProductSchema },` to the `MongooseModule.forFeature([...])` array.

- [ ] **Step 2: Inject + cascade** — in `cascade.service.ts`:
  - add `import { Product } from '../../products/product.schema';`
  - add a constructor param `@InjectModel(Product.name) private readonly products: Model<Product>,`
  - in `deleteWorkspace`, add `this.products.updateMany({ workspaceId }, patch),` to the `Promise.all([...])`.
  - in `deleteProject`, after the project patch, add `await this.products.updateMany({ projectId }, patch);`

- [ ] **Step 3: Verify** — `pnpm --filter @lyra/api run type-check && pnpm --filter @lyra/api build`. (If a cascade spec exists — check `apps/api/src/common/database/*.spec.ts` and `apps/api/test/*cascade*` — extend it to assert products are soft-deleted; if none exists, the e2e in Task 5 covers the delete path. Do not invent a new test harness.)

- [ ] **Step 4: Commit** —
```bash
git add apps/api/src/common/database/cascade.service.ts apps/api/src/common/database/cascade.module.ts
git commit -m "feat(api): cascade soft-delete Products with their Project/Workspace"
```

---

## Task 5: Full gate + boot check

- [ ] **Step 1: Full gate (serial)** —
```bash
pnpm --filter @lyra/shared build
pnpm --filter @lyra/shared test
pnpm --filter @lyra/api run type-check && pnpm --filter @lyra/api exec jest --runInBand && pnpm --filter @lyra/api build
pnpm --filter @lyra/shared --filter @lyra/api run lint
```
Expected: all green, lint 0. (Web untouched.)

- [ ] **Step 2: Boot check (DI).** A guarded feature module that doesn't import the module exporting its guard deps boots-fails but builds fine (the `nestjs-di-boot-verify` lesson). Confirm the api can instantiate `ProductsModule`: either an existing e2e spins the full `AppModule` (run `pnpm --filter @lyra/api test:e2e` if present and fast), or note that the deploy step's `pm2` boot + `/health` 200 is the real DI gate. Report which was used.

- [ ] **Step 3: Whole-branch review** — generate the branch diff (`scripts/review-package MERGE_BASE HEAD`) and dispatch a reviewer for spec compliance + quality; fix Critical/Important. No security-reviewer needed (no auth/key/tenancy change beyond reusing `ProjectAccessGuard` + workspace-scoped queries — but confirm those are correctly reused, not reimplemented).

- [ ] **Step 4: STOP — deploy gated on the user.** Per the standing rule, do not push/restart. Report gate results and ask: ship to dev? (api change → on approval: ff-merge → codex-dev, rebuild shared+api dist, `pm2 restart lyra-api`, boot-verify, `git push origin codex-dev:dev`.)

---

## Self-Review

**Spec coverage:** Product entity (project-owned, §4) → Task 3. EvidenceClaim + SourceRow + ConfidenceKind (§1B) → Task 1. UnitEcon types + `computeUnitEcon` (§1D) → Tasks 1–2. WEIGHTS + SubScores + `weightedScore`/`gradeConfidence`/`decide` (§1E) → Tasks 1–2. Cascade (§4 BUILD) → Task 4. DTO interfaces in shared + class-validator classes implementing them (invariant 2) → Tasks 1, 3. Reuse `ProjectAccessGuard`, no new access logic (§4) → Task 3. **Deferred (flagged):** `runScenarios`, `resolveInputs`, the agentic provider, the pipeline template, the `productId` back-references — all listed in Scope.

**Placeholder scan:** every code step contains literal code; commands have expected outcomes. The two "read the existing file first" notes (Task 3 Step 8 service spec; Task 4 Step 3 cascade spec) are real-codebase adaptations with concrete assertions named, not vague TODOs.

**Type consistency:** `ProductStatus`, `Product`, `CreateProductDto`/`UpdateProductDto`, `UnitEconInputs`/`UnitEcon`, `SubScores`/`WEIGHTS`, `EvidenceClaim`, `HardGates`/`Decision` are defined in Task 1 and consumed with identical names in Tasks 2–4. `computeUnitEcon`/`weightedScore`/`gradeConfidence`/`decide` signatures match between Task 2 def, its test, and the (future) pipeline consumer. `toProductView` returns the shared `Product` shape used by the service.

**Assumptions to confirm with the user** (pure + tested → one-line changes): gradeConfidence thresholds + the new `purchaseData` flag; decide score-bands (75/60/45) + gate→decision mapping. Both listed at the top under "Assumptions baked into this plan."
