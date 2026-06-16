import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { KeysModule } from '../keys/keys.module';
import { UsersModule } from '../users/users.module';
import { Run, RunSchema } from './run.schema';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { RunAccessGuard } from './guards/run-access.guard';
import { AnthropicClient } from './providers/anthropic.client';
import { AnthropicStepProvider } from './providers/anthropic.provider';
import { MockStepProvider } from './providers/mock.provider';
import { ProviderRegistry } from './providers/provider.registry';

@Module({
  imports: [
    WorkspacesModule, // MembershipsService
    ProjectsModule, // ProjectsService + ProjectAccessGuard
    KeysModule, // KeysService (per-step key gating + decryption)
    UsersModule, // UsersService (ref expansion)
    MongooseModule.forFeature([{ name: Run.name, schema: RunSchema }]),
  ],
  controllers: [RunsController],
  providers: [
    RunsService,
    RunAccessGuard,
    // Step execution: one StepProvider per Provider, dispatched via the registry.
    AnthropicClient,
    AnthropicStepProvider,
    MockStepProvider,
    ProviderRegistry,
  ],
})
export class RunsModule {}
