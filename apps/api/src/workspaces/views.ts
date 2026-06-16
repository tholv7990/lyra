import type { Role, WorkspaceView, MemberView, Invite } from '@lyra/shared';
import type { WorkspaceDocument } from './workspace.schema';
import type { MembershipDocument } from './membership.schema';
import type { InviteDocument } from './invite.schema';

export function toWorkspaceView(
  w: WorkspaceDocument,
  role: Role,
  canManageKeys: boolean,
): WorkspaceView {
  return {
    id: w._id.toString(),
    name: w.name,
    type: w.type,
    createdBy: w.createdBy,
    createdAt: w.createdAt.toISOString(),
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

export function toInviteView(i: InviteDocument): Invite {
  return {
    id: i._id.toString(),
    workspaceId: i.workspaceId,
    email: i.email,
    role: i.role,
    status: i.status,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}
