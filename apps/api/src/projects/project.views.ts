import type { Project as ProjectModel, UserRef } from '@lyra/shared';
import type { ProjectDocument } from './project.schema';
import { userRef, userRefs } from '../common/refs';
import { iso } from '../common/dates';

export function toProject(
  p: ProjectDocument,
  refs: Map<string, UserRef>,
): ProjectModel {
  return {
    id: p._id.toString(),
    workspaceId: p.workspaceId,
    name: p.name,
    product: p.product,
    niche: p.niche,
    homepageUrl: p.homepageUrl,
    brandBrief: p.brandBrief,
    learnings: p.learnings,
    visibility: p.visibility,
    sharedWith: userRefs(p.sharedWith, refs),
    active: p.active ?? true,
    createdBy: userRef(p.createdBy, refs),
    updatedBy: userRef(p.updatedBy, refs),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt ?? p.createdAt),
  };
}

// Collect every user id a project references (for batch resolution).
export function projectActorIds(p: ProjectDocument): string[] {
  return [p.createdBy, p.updatedBy, ...p.sharedWith];
}
