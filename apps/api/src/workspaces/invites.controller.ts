import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type { MyInvite, User, WorkspaceView } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InvitesService } from './invites.service';
import { WorkspacesService } from './workspaces.service';
import { MembershipsService } from './memberships.service';
import { AcceptInviteBody } from './dto/workspaces.dto';

// Invite acceptance is not workspace-scoped (the caller isn't a member yet),
// so it lives outside /workspaces/:id and behind the global JwtAuthGuard only.
@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
  ) {}

  @Post('accept')
  @HttpCode(200)
  async accept(
    @Body() body: AcceptInviteBody,
    @CurrentUser() user: User,
  ): Promise<WorkspaceView> {
    const workspaceId = await this.invites.accept(body.token, {
      id: user.id,
      email: user.email,
    });
    const ws = await this.workspaces.findById(workspaceId);
    const membership = await this.memberships.findFor(workspaceId, user.id);
    if (!ws || !membership) throw new NotFoundException('Workspace not found');
    return this.workspaces.toView(ws, membership.role, membership.canManageKeys);
  }

  // The current user's pending invites, for the notification bell.
  @Get('mine')
  listMine(@CurrentUser() user: User): Promise<MyInvite[]> {
    return this.invites.listMine({ id: user.id, email: user.email });
  }

  // Accept in-app (no token): authorized by the user's email matching the invite.
  @Post(':id/accept')
  @HttpCode(204)
  async acceptById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.invites.acceptById(id, { id: user.id, email: user.email });
  }

  @Post(':id/decline')
  @HttpCode(204)
  async decline(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.invites.decline(id, { id: user.id, email: user.email });
  }
}
