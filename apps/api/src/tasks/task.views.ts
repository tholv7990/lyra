import type { Task as TaskView, UserRef } from '@lyra/shared';
import type { TaskDocument } from './task.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

// Safe transport shape. `assignee` is the expanded UserRef (omitted when unset);
// the raw assigneeId stays server-only.
export function toTaskView(d: TaskDocument, refs: Map<string, UserRef>): TaskView {
  return {
    id: d._id.toString(),
    workspaceId: d.workspaceId,
    projectId: d.projectId,
    name: d.name,
    description: d.description ?? '',
    status: d.status,
    assignee: d.assigneeId ? userRef(d.assigneeId, refs) : undefined,
    pipelines: d.pipelines ?? [],
    active: d.active ?? true,
    createdBy: userRef(d.createdBy, refs),
    updatedBy: userRef(d.updatedBy, refs),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
}
