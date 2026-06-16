import type {
  Role,
  WorkspaceView,
  MemberView,
  Invite,
  UserRef,
} from '@lyra/shared';
import type { WorkspaceDocument } from './workspace.schema';
import type { MembershipDocument } from './membership.schema';
import type { InviteDocument } from './invite.schema';
import { userRef } from '../common/refs';

export function toWorkspaceView(
  w: WorkspaceDocument,
  role: Role,
  canManageKeys: boolean,
  refs: Map<string, UserRef>,
): WorkspaceView {
  return {
    id: w._id.toString(),
    name: w.name,
    type: w.type,
    active: w.active,
    createdBy: userRef(w.createdBy, refs),
    updatedBy: userRef(w.updatedBy, refs),
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    role,
    canManageKeys,
  };
}

export function toMemberView(
  m: MembershipDocument,
  user: { email: string; name: string },
): MemberView {
  return {
    membershipId: m._id.toString(),
    workspaceId: m.workspaceId,
    userId: m.userId,
    email: user.email,
    name: user.name,
    role: m.role,
    canManageKeys: m.canManageKeys,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toInviteView(
  i: InviteDocument,
  refs: Map<string, UserRef>,
): Invite {
  return {
    id: i._id.toString(),
    workspaceId: i.workspaceId,
    email: i.email,
    role: i.role,
    status: i.status,
    active: i.active,
    createdBy: userRef(i.createdBy, refs),
    updatedBy: userRef(i.updatedBy, refs),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
  };
}
