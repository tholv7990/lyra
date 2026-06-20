import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Role, WorkspaceType, type Invite as InviteModel, type MyInvite } from '@lyra/shared';
import { Invite, InviteDocument } from './invite.schema';
import { MembershipsService } from './memberships.service';
import { WorkspacesService } from './workspaces.service';
import { UsersService } from '../users/users.service';
import { BaseRepository } from '../common/database/base.repository';
import { toInviteView, toMyInviteView } from './views';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class InvitesService extends BaseRepository<Invite> {
  constructor(
    @InjectModel(Invite.name) model: Model<Invite>,
    private readonly memberships: MembershipsService,
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model);
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async toView(doc: InviteDocument): Promise<InviteModel> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toInviteView(doc, refs);
  }

  async toViews(docs: InviteDocument[]): Promise<InviteModel[]> {
    const refs = await this.users.refMap(
      docs.flatMap((d) => [d.createdBy, d.updatedBy]),
    );
    return docs.map((d) => toInviteView(d, refs));
  }

  async createInvite(data: {
    workspaceId: string;
    email: string;
    role: Role;
    invitedBy: string;
  }): Promise<{ invite: InviteDocument; token: string }> {
    const ws = await this.workspaces.findById(data.workspaceId);
    if (!ws) throw new NotFoundException('Workspace not found');
    if (ws.type !== WorkspaceType.Team) {
      throw new BadRequestException('Invites require a team workspace');
    }
    const raw = randomBytes(32).toString('hex');
    const invite = await this.create({
      workspaceId: data.workspaceId,
      email: data.email.toLowerCase(),
      role: data.role,
      tokenHash: this.hashToken(raw),
      status: 'pending',
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      createdBy: data.invitedBy,
      updatedBy: data.invitedBy,
    });
    return { invite, token: raw };
  }

  listPending(workspaceId: string) {
    return this.find({ workspaceId, status: 'pending' });
  }

  listForEmail(email: string) {
    return this.find({
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
  }

  // Pending invites for the current user, enriched for the notification bell.
  async listMine(user: { id: string; email: string }): Promise<MyInvite[]> {
    const docs = await this.listForEmail(user.email);
    if (docs.length === 0) return [];
    const refs = await this.users.refMap(docs.map((d) => d.createdBy));
    // ponytail: per-invite workspace lookup; the pending list is a handful.
    const out: MyInvite[] = [];
    for (const d of docs) {
      const ws = await this.workspaces.findById(d.workspaceId);
      if (!ws) continue; // workspace gone — skip the stale invite
      out.push(toMyInviteView(d, ws.name, refs));
    }
    return out;
  }

  // Soft delete: mark inactive (and revoked).
  revoke(id: string, updatedBy: string) {
    return this.findByIdAndUpdate(id, {
      status: 'revoked',
      active: false,
      updatedBy,
    });
  }

  // Accept a pending invite via the email link's raw token.
  async accept(
    rawToken: string,
    user: { id: string; email: string },
  ): Promise<string> {
    const invite = await this.findOne({
      tokenHash: this.hashToken(rawToken),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    if (!invite) throw new NotFoundException('Invalid or expired invite');
    if (invite.email !== user.email.toLowerCase()) {
      throw new ForbiddenException('This invite is for a different email');
    }
    return this.materialize(invite, user);
  }

  // Accept in-app: the logged-in user's email is the authorization (no token).
  async acceptById(
    inviteId: string,
    user: { id: string; email: string },
  ): Promise<string> {
    const invite = await this.findById(inviteId);
    if (!invite || invite.status !== 'pending' || invite.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Invalid or expired invite');
    }
    if (invite.email !== user.email.toLowerCase()) {
      throw new ForbiddenException('This invite is for a different email');
    }
    return this.materialize(invite, user);
  }

  async decline(
    inviteId: string,
    user: { id: string; email: string },
  ): Promise<void> {
    const invite = await this.findById(inviteId);
    if (!invite || invite.status !== 'pending' || invite.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.email !== user.email.toLowerCase()) {
      throw new ForbiddenException('This invite is for a different email');
    }
    await this.findByIdAndUpdate(inviteId, {
      status: 'declined',
      active: false,
      updatedBy: user.id,
    });
  }

  // Create the membership (idempotent if already a member) and mark accepted.
  private async materialize(
    invite: InviteDocument,
    user: { id: string; email: string },
  ): Promise<string> {
    const existing = await this.memberships.findFor(invite.workspaceId, user.id);
    if (existing) {
      await this.findByIdAndUpdate(invite.id, { status: 'accepted', updatedBy: user.id });
      return invite.workspaceId;
    }
    await this.connection.transaction(async (session) => {
      await this.memberships.create(
        {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
          canManageKeys: false,
          createdBy: user.id,
          updatedBy: user.id,
        },
        session,
      );
      await this.model.findByIdAndUpdate(
        invite._id,
        { status: 'accepted', updatedBy: user.id },
        { session },
      );
    });
    return invite.workspaceId;
  }
}
