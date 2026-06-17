import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { CascadeModule } from '../common/database/cascade.module';
import { Pipeline, PipelineSchema } from './pipeline.schema';
import { PipelinesService } from './pipelines.service';
import { PipelinesController } from './pipelines.controller';
import { PipelineAccessGuard } from './guards/pipeline-access.guard';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // ref expansion
    CascadeModule, // soft-delete cascade (pulls pipeline refs off projects)
    MongooseModule.forFeature([{ name: Pipeline.name, schema: PipelineSchema }]),
  ],
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelineAccessGuard],
  exports: [PipelinesService],
})
export class PipelinesModule {}
