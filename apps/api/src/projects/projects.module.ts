import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { CascadeModule } from '../common/database/cascade.module';
import { Project, ProjectSchema } from './project.schema';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { Task, TaskSchema } from '../tasks/task.schema';
import { Pipeline, PipelineSchema } from '../pipelines/pipeline.schema';
import { Prompt, PromptSchema } from '../prompts/prompt.schema';
import { Workspace, WorkspaceSchema } from '../workspaces/workspace.schema';
import { Membership, MembershipSchema } from '../workspaces/membership.schema';
import { ApiKey, ApiKeySchema } from '../keys/api-key.schema';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // UsersService (ref expansion)
    CascadeModule, // soft-delete cascade
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Pipeline.name, schema: PipelineSchema },
      { name: Prompt.name, schema: PromptSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
    ]),
  ],
  controllers: [ProjectsController, TransferController],
  providers: [ProjectsService, ProjectAccessGuard, TransferService],
  // Exported so RunsModule can load projects + reuse the access guard.
  exports: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
