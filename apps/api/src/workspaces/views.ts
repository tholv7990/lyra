import type {
  Role,
  WorkspaceView,
  MemberView,
  Invite,
  MyInvite,
  UserRef,
} from '@lyra/shared';
import type { WorkspaceDocument } from './workspace.schema';
import type { MembershipDocument } from './membership.schema';
import type { InviteDocument } from './invite.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

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
    active: w.active ?? true,
    createdBy: userRef(w.createdBy, refs),
    updatedBy: userRef(w.updatedBy, refs),
    createdAt: iso(w.createdAt),
    updatedAt: iso(w.updatedAt ?? w.createdAt),
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
    createdAt: iso(m.createdAt),
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
    active: i.active ?? true,
    createdBy: userRef(i.createdBy, refs),
    updatedBy: userRef(i.updatedBy, refs),
    createdAt: iso(i.createdAt),
    updatedAt: iso(i.updatedAt ?? i.createdAt),
    expiresAt: iso(i.expiresAt),
  };
}

export function toMyInviteView(
  i: InviteDocument,
  workspaceName: string,
  refs: Map<string, UserRef>,
): MyInvite {
  return {
    id: i._id.toString(),
    workspaceId: i.workspaceId,
    workspaceName,
    role: i.role,
    invitedBy: userRef(i.createdBy, refs),
    createdAt: iso(i.createdAt),
    expiresAt: iso(i.expiresAt),
  };
}
