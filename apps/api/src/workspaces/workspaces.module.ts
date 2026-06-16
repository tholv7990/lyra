import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Workspace, WorkspaceSchema } from './workspace.schema';
import { Membership, MembershipSchema } from './membership.schema';
import { Invite, InviteSchema } from './invite.schema';
import { WorkspacesService } from './workspaces.service';
import { MembershipsService } from './memberships.service';
import { InvitesService } from './invites.service';
import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspacesController } from './workspaces.controller';
import { InvitesController } from './invites.controller';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Invite.name, schema: InviteSchema },
    ]),
  ],
  controllers: [WorkspacesController, InvitesController],
  providers: [
    WorkspacesService,
    MembershipsService,
    InvitesService,
    WorkspaceGuard,
  ],
  // Exported so AuthModule can create the personal workspace on signup.
  exports: [WorkspacesService, MembershipsService],
})
export class WorkspacesModule {}
