import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { KeysModule } from '../keys/keys.module';
import { PromptsModule } from '../prompts/prompts.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { ProjectsModule } from '../projects/projects.module';
import { RunsModule } from '../runs/runs.module';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + membership
    KeysModule, // decrypt the Anthropic key
    PromptsModule, // read tools
    PipelinesModule,
    ProjectsModule,
    RunsModule,
  ],
  controllers: [CopilotController],
  providers: [CopilotService, AnthropicClient],
})
export class CopilotModule {}
