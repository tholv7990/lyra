import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { User, UserSchema } from '../users/user.schema';
import { Membership, MembershipSchema } from '../workspaces/membership.schema';
import { Workspace, WorkspaceSchema } from '../workspaces/workspace.schema';
import { Project, ProjectSchema } from '../projects/project.schema';
import { Pipeline, PipelineSchema } from '../pipelines/pipeline.schema';
import { Prompt, PromptSchema } from '../prompts/prompt.schema';
import { Run, RunSchema } from '../runs/run.schema';
import {
  Conversation,
  ConversationSchema,
} from '../conversations/conversation.schema';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminUsersService } from './admin-users.service';
import { AdminMarketplaceController } from './admin-marketplace.controller';
import { AdminUsersController } from './admin-users.controller';

// Super-admin layer: the env-allowlist admin check (AdminService), the route
// gate (AdminGuard), and global admin endpoints. ConfigModule is global, but we
// import it for explicitness. MarketplaceModule provides the reused importer.
// The read-only models below back the platform Overview + User management — a
// legitimate admin concern aggregating across collections it does not own.
@Module({
  imports: [
    ConfigModule,
    MarketplaceModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Pipeline.name, schema: PipelineSchema },
      { name: Prompt.name, schema: PromptSchema },
      { name: Run.name, schema: RunSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [AdminMarketplaceController, AdminUsersController],
  providers: [AdminService, AdminGuard, AdminUsersService],
  exports: [AdminService],
})
export class AdminModule {}
