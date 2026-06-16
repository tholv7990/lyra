import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { User, WorkspaceView } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InvitesService } from './invites.service';
import { WorkspacesService } from './workspaces.service';
import { MembershipsService } from './memberships.service';
import { AcceptInviteBody } from './dto/workspaces.dto';
import { toWorkspaceView } from './views';

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
    return toWorkspaceView(ws, membership.role, membership.canManageKeys);
  }
}
