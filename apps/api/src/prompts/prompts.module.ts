import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { Prompt, PromptSchema } from './prompt.schema';
import { PromptsService } from './prompts.service';
import { PromptsController } from './prompts.controller';
import { PromptAccessGuard } from './guards/prompt-access.guard';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // UsersService (ref expansion)
    MongooseModule.forFeature([{ name: Prompt.name, schema: PromptSchema }]),
  ],
  controllers: [PromptsController],
  providers: [PromptsService, PromptAccessGuard],
  exports: [PromptsService],
})
export class PromptsModule {}
