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
import { ConnectorsModule } from '../connectors/connectors.module';
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
import { GeminiClient } from './providers/gemini.client';
import { GeminiImageStepProvider } from './providers/gemini-image.provider';
import { ReplicateClient } from './providers/replicate.client';
import { VideoStepProvider } from './providers/video.provider';
import { ProviderRegistry } from './providers/provider.registry';
import { RenderClient } from './providers/render.client';
import { BrandActionProvider } from './providers/brand.action';
import { UnitEconAction } from './providers/unit-econ.action';
import { EvaluateAction } from './providers/evaluate.action';
import { ActionRegistry } from './providers/action.registry';
import { TavilyClient } from './providers/tavily.client';
import { ResearchStepProvider } from './providers/research.provider';

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
    ConnectorsModule, // ConnectorCredentialsService — Tavily key for ResearchStepProvider
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
    GeminiClient,
    GeminiImageStepProvider,
    ReplicateClient,
    VideoStepProvider,
    ProviderRegistry,
    // Action execution: one ActionProvider per ActionType, dispatched via ActionRegistry.
    RenderClient,
    BrandActionProvider,
    UnitEconAction,
    EvaluateAction,
    ActionRegistry,
    // Research step: Tavily search + multi-provider LLM agentic loop.
    TavilyClient,
    ResearchStepProvider,
  ],
  exports: [RunsService], // Lyra Copilot reads runs
})
export class RunsModule {}
