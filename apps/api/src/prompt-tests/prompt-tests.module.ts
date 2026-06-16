import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { KeysModule } from '../keys/keys.module';
import { PromptsModule } from '../prompts/prompts.module';
import { PromptTest, PromptTestSchema } from './prompt-test.schema';
import { PromptTestsService } from './prompt-tests.service';
import { PromptTestsController } from './prompt-tests.controller';
import { AnthropicClient } from '../runs/providers/anthropic.client';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // ref expansion
    KeysModule, // decrypt provider key
    PromptsModule, // load + visibility-check the prompt
    MongooseModule.forFeature([
      { name: PromptTest.name, schema: PromptTestSchema },
    ]),
  ],
  controllers: [PromptTestsController],
  providers: [PromptTestsService, AnthropicClient],
})
export class PromptTestsModule {}
