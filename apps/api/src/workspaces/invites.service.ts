import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Role, type Invite as InviteModel } from '@lyra/shared';
import { Invite, InviteDocument } from './invite.schema';
import { MembershipsService } from './memberships.service';
import { UsersService } from '../users/users.service';
import { BaseRepository } from '../common/database/base.repository';
import { toInviteView } from './views';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class InvitesService extends BaseRepository<Invite> {
  constructor(
    @InjectModel(Invite.name) model: Model<Invite>,
    private readonly memberships: MembershipsService,
    private readonly users: UsersService,
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

  // Soft delete: mark inactive (and revoked).
  revoke(id: string, updatedBy: string) {
    return this.findByIdAndUpdate(id, {
      status: 'revoked',
      active: false,
      updatedBy,
    });
  }

  // Accept a pending invite: the logged-in user's email must match the invite.
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
