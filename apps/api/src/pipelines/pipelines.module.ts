import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { CascadeModule } from '../common/database/cascade.module';
import { PromptsModule } from '../prompts/prompts.module';
import { KeysModule } from '../keys/keys.module';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { Pipeline, PipelineSchema } from './pipeline.schema';
import { Run, RunSchema } from '../runs/run.schema';
import { PipelinesService } from './pipelines.service';
import { PipelineAiService } from './pipeline-ai.service';
import { ResearchTemplateService } from './research-template.service';
import { PipelinesController } from './pipelines.controller';
import { PipelineAccessGuard } from './guards/pipeline-access.guard';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // ref expansion
    CascadeModule, // soft-delete cascade (pulls pipeline refs off projects)
    PromptsModule, // AI generator reads the public prompt library
    KeysModule, // AI generator decrypts the workspace Anthropic key
    MongooseModule.forFeature([
      { name: Pipeline.name, schema: PipelineSchema },
      { name: Run.name, schema: RunSchema },
    ]),
  ],
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelineAiService, ResearchTemplateService, PipelineAccessGuard, AnthropicClient],
  exports: [PipelinesService],
})
export class PipelinesModule {}
