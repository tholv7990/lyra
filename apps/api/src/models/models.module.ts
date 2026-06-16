import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { KeysModule } from '../keys/keys.module';
import { ProviderModel, ProviderModelSchema } from './provider-model.schema';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../runs/providers/openai-compat.client';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + manage-keys
    KeysModule, // KeysService (decrypt)
    MongooseModule.forFeature([
      { name: ProviderModel.name, schema: ProviderModelSchema },
    ]),
  ],
  controllers: [ModelsController],
  providers: [ModelsService, AnthropicClient, OpenAiCompatClient],
  exports: [ModelsService],
})
export class ModelsModule {}
