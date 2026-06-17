import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { KeysModule } from '../keys/keys.module';
import { FilesModule } from '../files/files.module';
import { Conversation, ConversationSchema } from './conversation.schema';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../runs/providers/openai-compat.client';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // ref expansion
    KeysModule, // decrypt provider key
    FilesModule, // read attachment bytes for the model call
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, AnthropicClient, OpenAiCompatClient],
})
export class ConversationsModule {}
