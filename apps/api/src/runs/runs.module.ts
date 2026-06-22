import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { KeysModule } from '../keys/keys.module';
import { UsersModule } from '../users/users.module';
import { PromptsModule } from '../prompts/prompts.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { AssetsModule } from '../assets/assets.module';
import { TasksModule } from '../tasks/tasks.module';
import { Run, RunSchema } from './run.schema';
import { StepResultCache, StepResultCacheSchema } from './step-cache.schema';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { RunAccessGuard } from './guards/run-access.guard';
import { AnthropicClient } from './providers/anthropic.client';
import { AnthropicStepProvider } from './providers/anthropic.provider';
import { OpenAiCompatClient } from './providers/openai-compat.client';
import { OpenAiCompatStepProvider } from './providers/openai-compat.provider';
import { CrawlStepProvider } from './providers/crawl.provider';
import { ImageStepProvider } from './providers/image.provider';
import { MockStepProvider } from './providers/mock.provider';
import { ProviderRegistry } from './providers/provider.registry';
import { RenderClient } from './providers/render.client';
import { BrandActionProvider } from './providers/brand.action';
import { ActionRegistry } from './providers/action.registry';

@Module({
  imports: [
    WorkspacesModule, // MembershipsService
    ProjectsModule, // ProjectsService + ProjectAccessGuard
    KeysModule, // KeysService (per-step key gating + decryption)
    UsersModule, // UsersService (ref expansion)
    PromptsModule, // load prompt content for pipeline runs
    PipelinesModule, // load a pipeline to run it
    AssetsModule, // persist media a step produces
    TasksModule, // TasksService — validate the task a run belongs to
    MongooseModule.forFeature([
      { name: Run.name, schema: RunSchema },
      { name: StepResultCache.name, schema: StepResultCacheSchema },
    ]),
  ],
  controllers: [RunsController],
  providers: [
    RunsService,
    RunAccessGuard,
    // Step execution: one StepProvider per Provider, dispatched via the registry.
    AnthropicClient,
    AnthropicStepProvider,
    OpenAiCompatClient,
    OpenAiCompatStepProvider,
    CrawlStepProvider,
    ImageStepProvider,
    MockStepProvider,
    ProviderRegistry,
    // Action execution: one ActionProvider per ActionType, dispatched via ActionRegistry.
    RenderClient,
    BrandActionProvider,
    ActionRegistry,
  ],
  exports: [RunsService], // Lyra Copilot reads runs
})
export class RunsModule {}
