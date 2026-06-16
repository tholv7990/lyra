import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Role } from '@lyra/shared';
import type { MemberView, WorkspaceView } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@lyra/shared';
import { WorkspacesService } from './workspaces.service';
import { MembershipsService } from './memberships.service';
import { InvitesService } from './invites.service';
import { UsersService } from '../users/users.service';
import { WorkspaceGuard } from './guards/workspace.guard';
import { RequireOwner } from './decorators/require-owner.decorator';
import {
  CurrentMembership,
  RequestMembership,
} from './decorators/current-membership.decorator';
import {
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
  InviteBody,
  UpdateMemberBody,
} from './dto/workspaces.dto';
import { toInviteView, toMemberView, toWorkspaceView } from './views';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly invites: InvitesService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // Create a team workspace; the creator becomes its owner (atomic).
  @Post()
  async create(
    @Body() body: CreateWorkspaceBody,
    @CurrentUser() user: User,
  ): Promise<WorkspaceView> {
    const workspace = await this.connection.transaction(async (session) => {
      const ws = await this.workspaces.create(
        { name: body.name, type: 'team', createdBy: user.id },
        session,
      );
      await this.memberships.create(
        {
          workspaceId: ws._id.toString(),
          userId: user.id,
          role: Role.Owner,
          canManageKeys: false,
        },
        session,
      );
      return ws;
    });
    return toWorkspaceView(workspace, Role.Owner, false);
  }

  @Get()
  list(@CurrentUser() user: User): Promise<WorkspaceView[]> {
    return this.workspaces.listForUser(user.id);
  }

  @Get(':id')
  @UseGuards(WorkspaceGuard)
  async get(
    @Param('id') id: string,
    @CurrentMembership() m: RequestMembership,
  ): Promise<WorkspaceView> {
    const ws = await this.workspaces.findById(id);
    if (!ws) throw new NotFoundException('Workspace not found');
    return toWorkspaceView(ws, m.role, m.canManageKeys);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  async rename(
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceBody,
    @CurrentMembership() m: RequestMembership,
  ): Promise<WorkspaceView> {
    const ws = await this.workspaces.rename(id, body.name);
    if (!ws) throw new NotFoundException('Workspace not found');
    return toWorkspaceView(ws, m.role, m.canManageKeys);
  }

  @Delete(':id')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    const ws = await this.workspaces.findById(id);
    if (!ws) throw new NotFoundException('Workspace not found');
    if (ws.type === 'personal') {
      throw new BadRequestException('Cannot delete your personal workspace');
    }
    await this.memberships.removeAllForWorkspace(id);
    await this.invites.removeAllForWorkspace(id);
    await this.workspaces.deleteById(id);
  }

  @Get(':id/members')
  @UseGuards(WorkspaceGuard)
  async members(@Param('id') id: string): Promise<MemberView[]> {
    const memberships = await this.memberships.listForWorkspace(id);
    const users = await this.users.findByIds(memberships.map((m) => m.userId));
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    return memberships.map((m) => {
      const u = byId.get(m.userId);
      return toMemberView(m, {
        email: u?.email ?? '(unknown)',
        name: u?.name ?? '(unknown)',
      });
    });
  }

  @Patch(':id/members/:uid')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  async updateMember(
    @Param('id') id: string,
    @Param('uid') uid: string,
    @Body() body: UpdateMemberBody,
  ): Promise<MemberView> {
    if (body.role && body.role !== Role.Owner) {
      const target = await this.memberships.findFor(id, uid);
      if (target?.role === Role.Owner && (await this.memberships.countOwners(id)) <= 1) {
        throw new BadRequestException('Cannot demote the last owner');
      }
    }
    const updated = await this.memberships.updateMembership(id, uid, body);
    if (!updated) throw new NotFoundException('Member not found');
    const u = await this.users.findById(uid);
    return toMemberView(updated, {
      email: u?.email ?? '(unknown)',
      name: u?.name ?? '(unknown)',
    });
  }

  @Delete(':id/members/:uid')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  @HttpCode(204)
  async removeMember(
    @Param('id') id: string,
    @Param('uid') uid: string,
  ): Promise<void> {
    const target = await this.memberships.findFor(id, uid);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === Role.Owner && (await this.memberships.countOwners(id)) <= 1) {
      throw new BadRequestException('Cannot remove the last owner');
    }
    await this.memberships.removeFor(id, uid);
  }

  @Get(':id/invites')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  async listInvites(@Param('id') id: string) {
    const invites = await this.invites.listPending(id);
    return invites.map(toInviteView);
  }

  @Post(':id/invites')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  async invite(
    @Param('id') id: string,
    @Body() body: InviteBody,
    @CurrentUser() user: User,
  ) {
    const { invite, token } = await this.invites.createInvite({
      workspaceId: id,
      email: body.email,
      role: body.role,
      invitedBy: user.id,
    });
    const webOrigin =
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
    // No email service yet (Phase 1 dev): return the token + accept link so the
    // flow is testable. Resend delivery lands when invites are productionized.
    return {
      invite: toInviteView(invite),
      token,
      acceptUrl: `${webOrigin}/invite?token=${token}`,
    };
  }

  @Delete(':id/invites/:iid')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  @HttpCode(204)
  async revokeInvite(
    @Param('id') id: string,
    @Param('iid') iid: string,
  ): Promise<void> {
    const inv = await this.invites.findById(iid);
    if (!inv || inv.workspaceId !== id) {
      throw new NotFoundException('Invite not found');
    }
    await this.invites.revoke(iid);
  }
}
