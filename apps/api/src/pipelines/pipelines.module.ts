import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { Pipeline, PipelineSchema } from './pipeline.schema';
import {
  ProjectPipeline,
  ProjectPipelineSchema,
} from './project-pipeline.schema';
import { PipelinesService } from './pipelines.service';
import { PipelinesController } from './pipelines.controller';
import { PipelineAccessGuard } from './guards/pipeline-access.guard';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    ProjectsModule, // ProjectAccessGuard for assignment routes
    UsersModule, // ref expansion
    MongooseModule.forFeature([
      { name: Pipeline.name, schema: PipelineSchema },
      { name: ProjectPipeline.name, schema: ProjectPipelineSchema },
    ]),
  ],
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelineAccessGuard],
  exports: [PipelinesService],
})
export class PipelinesModule {}
