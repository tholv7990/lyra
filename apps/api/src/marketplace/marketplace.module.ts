import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PromptsModule } from '../prompts/prompts.module';
import { KeysModule } from '../keys/keys.module';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import {
  MarketplacePrompt,
  MarketplacePromptSchema,
} from './marketplace.schema';
import { MarketplaceService } from './marketplace.service';
import { PromptRankService } from './prompt-rank.service';
import { MarketplaceFetcher } from './marketplace.fetcher';
import { MarketplaceController } from './marketplace.controller';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    PromptsModule, // PromptsService (adopt -> create a real Prompt)
    KeysModule, // decrypt the workspace Anthropic key for the AI filter
    MongooseModule.forFeature([
      { name: MarketplacePrompt.name, schema: MarketplacePromptSchema },
    ]),
  ],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    PromptRankService,
    MarketplaceFetcher,
    AnthropicClient,
  ],
})
export class MarketplaceModule {}
