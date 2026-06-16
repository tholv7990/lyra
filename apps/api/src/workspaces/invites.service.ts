import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Role } from '@lyra/shared';
import { Invite, InviteDocument } from './invite.schema';
import { MembershipsService } from './memberships.service';
import { BaseRepository } from '../common/database/base.repository';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class InvitesService extends BaseRepository<Invite> {
  constructor(
    @InjectModel(Invite.name) model: Model<Invite>,
    private readonly memberships: MembershipsService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model);
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
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
      invitedBy: data.invitedBy,
      status: 'pending',
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    return { invite, token: raw };
  }

  listPending(workspaceId: string) {
    return this.find({ workspaceId, status: 'pending' });
  }

  revoke(id: string) {
    return this.findByIdAndUpdate(id, { status: 'revoked' });
  }

  removeAllForWorkspace(workspaceId: string) {
    return this.deleteMany({ workspaceId });
  }

  // Accept a pending invite: the logged-in user's email must match the invite.
  // Creates the membership and marks the invite accepted atomically.
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
      await this.findByIdAndUpdate(invite.id, { status: 'accepted' });
      return invite.workspaceId;
    }

    await this.connection.transaction(async (session) => {
      await this.memberships.create(
        {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
          canManageKeys: false,
        },
        session,
      );
      await this.findByIdAndUpdate(invite.id, { status: 'accepted' }, session);
    });
    return invite.workspaceId;
  }
}
