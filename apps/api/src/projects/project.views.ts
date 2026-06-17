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
    description: p.description,
    variables: (p.variables ?? []).map((v) => ({ key: v.key, value: v.value })),
    status: p.status,
    shared: p.shared,
    sharedWith: userRefs(p.sharedWith, refs),
    pipelines: p.pipelines ?? [],
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
