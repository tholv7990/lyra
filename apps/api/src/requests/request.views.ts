import type { UserRequest as UserRequestView, UserRef } from '@lyra/shared';
import type { UserRequestDocument } from './user-request.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

// Normalized subject key — trim, lowercase, collapse whitespace. Reserved for
// dedup when the voting board ships.
export function subjectKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Safe transport shape. `voteCount` is derived from the voters list; the raw
// voter ids stay server-only.
export function toUserRequestView(
  d: UserRequestDocument,
  refs: Map<string, UserRef>,
): UserRequestView {
  return {
    id: d._id.toString(),
    type: d.type,
    subject: d.subject,
    body: d.body ?? '',
    status: d.status,
    adminNote: d.adminNote,
    workspaceId: d.workspaceId,
    voteCount: d.voters?.length ?? 0,
    active: d.active ?? true,
    createdBy: userRef(d.createdBy, refs),
    updatedBy: userRef(d.updatedBy, refs),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
}
