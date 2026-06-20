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
import type { Invite, MemberView, WorkspaceView, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
  UpdateWorkspaceBody,
  InviteBody,
  UpdateMemberBody,
} from './dto/workspaces.dto';
import { toMemberView } from './views';
import { CascadeService } from '../common/database/cascade.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly invites: InvitesService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly cascade: CascadeService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

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
    return this.workspaces.toView(ws, m.role, m.canManageKeys);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  async rename(
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceBody,
    @CurrentMembership() m: RequestMembership,
  ): Promise<WorkspaceView> {
    const ws = await this.workspaces.rename(id, body.name, m.userId);
    if (!ws) throw new NotFoundException('Workspace not found');
    return this.workspaces.toView(ws, m.role, m.canManageKeys);
  }

  @Delete(':id')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentMembership() m: RequestMembership,
  ): Promise<void> {
    const ws = await this.workspaces.findById(id);
    if (!ws) throw new NotFoundException('Workspace not found');
    if (ws.type === 'personal') {
      throw new BadRequestException('Cannot delete your personal workspace');
    }
    await this.cascade.deleteWorkspace(id, m.userId);
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
    @CurrentMembership() m: RequestMembership,
  ): Promise<MemberView> {
    if (body.role && body.role !== Role.Owner) {
      const target = await this.memberships.findFor(id, uid);
      if (target?.role === Role.Owner && (await this.memberships.countOwners(id)) <= 1) {
        throw new BadRequestException('Cannot demote the last owner');
      }
    }
    const updated = await this.memberships.updateMembership(id, uid, body, m.userId);
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
    @CurrentMembership() m: RequestMembership,
  ): Promise<void> {
    const target = await this.memberships.findFor(id, uid);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === Role.Owner && (await this.memberships.countOwners(id)) <= 1) {
      throw new BadRequestException('Cannot remove the last owner');
    }
    await this.memberships.removeFor(id, uid, m.userId);
  }

  @Get(':id/invites')
  @UseGuards(WorkspaceGuard)
  @RequireOwner()
  async listInvites(@Param('id') id: string): Promise<Invite[]> {
    return this.invites.toViews(await this.invites.listPending(id));
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
    return {
      invite: await this.invites.toView(invite),
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
    @CurrentMembership() m: RequestMembership,
  ): Promise<void> {
    const inv = await this.invites.findById(iid);
    if (!inv || inv.workspaceId !== id) {
      throw new NotFoundException('Invite not found');
    }
    await this.invites.revoke(iid, m.userId);
  }
}
