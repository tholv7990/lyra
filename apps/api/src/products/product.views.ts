import { ProductStatus, type Product as ProductView, type UserRef } from '@lyra/shared';
import type { ProductDocument } from './product.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

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
    active: d.active ?? true,
    createdBy: userRef(d.createdBy, refs),
    updatedBy: userRef(d.updatedBy, refs),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
}
