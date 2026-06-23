import { ProductStatus, type Product as ProductView, type SavedResult, type Provider, type UserRef } from '@lyra/shared';
import type { ProductDocument, ProductResultItem } from './product.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

// Subdocs carry an _id at runtime that the class type doesn't declare.
type ResultDoc = ProductResultItem & { _id: { toString(): string } };

export function toProductView(d: ProductDocument, refs: Map<string, UserRef>): ProductView {
  return {
    id: d._id.toString(),
    workspaceId: d.workspaceId,
    projectId: d.projectId,
    originatingProjectId: d.originatingProjectId,
    poolProductId: d.poolProductId,
    poolSnapshotAt: d.poolSnapshotAt,
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
    images: d.images ?? [],
    price: d.price,
    compareAtPrice: d.compareAtPrice,
    offer: d.offer,
    results: ((d.results ?? []) as ResultDoc[]).map(
      (r): SavedResult => ({
        id: r._id?.toString() ?? '',
        output: r.output,
        provider: r.provider as Provider,
        model: r.model,
        promptSnapshot: '',
        assetUrl: r.assetUrl,
        assetType: r.assetType as SavedResult['assetType'],
        runId: r.runId,
        stepIndex: r.stepIndex,
        rating: r.rating,
        note: r.note,
        createdBy: userRef(r.createdBy, refs),
        savedAt: iso(r.savedAt),
      }),
    ),
    active: d.active ?? true,
    createdBy: userRef(d.createdBy, refs),
    updatedBy: userRef(d.updatedBy, refs),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
}

// Collect every user id a product references (for batch resolution) — the
// product's own actors plus every saved-result author.
export function productActorIds(d: ProductDocument): string[] {
  return [
    d.createdBy,
    d.updatedBy,
    ...((d.results ?? []) as ResultDoc[]).map((r) => r.createdBy),
  ];
}
