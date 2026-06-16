import type { Project as ProjectModel } from '@lyra/shared';
import type { ProjectDocument } from './project.schema';

export function toProject(p: ProjectDocument): ProjectModel {
  return {
    id: p._id.toString(),
    workspaceId: p.workspaceId,
    createdBy: p.createdBy,
    name: p.name,
    product: p.product,
    niche: p.niche,
    homepageUrl: p.homepageUrl,
    brandBrief: p.brandBrief,
    learnings: p.learnings,
    visibility: p.visibility,
    sharedWith: p.sharedWith,
    createdAt: p.createdAt.toISOString(),
  };
}
