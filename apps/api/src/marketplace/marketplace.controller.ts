import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  MarketplacePrompt,
  Paged,
  Prompt as PromptModel,
  RankedMarketplacePrompt,
  User,
} from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { MarketplaceService } from './marketplace.service';
import { PromptRankService } from './prompt-rank.service';
import { AdoptMarketplacePromptBody, MarketplaceRankBody } from './dto/marketplace.dto';

// The global, read-only prompt marketplace, accessed in a workspace context.
// Browse + rank + adopt = any member. Global catalog sync is super-admin only
// and lives on the admin route (POST /admin/marketplace/sync).
@Controller('workspaces/:id/marketplace')
@UseGuards(WorkspaceGuard)
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly rankService: PromptRankService,
  ) {}

  // Browse the catalog: q matches title/content (case-insensitive); forDevs is
  // an optional 'true'/'false' filter.
  @Get('prompts')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('forDevs') forDevs?: string,
  ): Promise<Paged<MarketplacePrompt>> {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit ?? '30', 10) || 30));
    let forDevsFilter: boolean | undefined;
    if (forDevs === 'true') forDevsFilter = true;
    else if (forDevs === 'false') forDevsFilter = false;
    return this.marketplace.list({
      q: q || undefined,
      forDevs: forDevsFilter,
      page: p,
      limit: l,
    });
  }

  // AI filter: rank the catalog against a free-text need via the workspace's
  // Anthropic key.
  @Post('rank')
  rank(
    @Param('id') workspaceId: string,
    @Body() body: MarketplaceRankBody,
  ): Promise<RankedMarketplacePrompt[]> {
    return this.rankService.rank(workspaceId, body.query, body.limit);
  }

  // Adopt a catalog item into the workspace prompt library (creates a Prompt).
  @Post('adopt')
  adopt(
    @Param('id') workspaceId: string,
    @Body() body: AdoptMarketplacePromptBody,
    @CurrentUser() user: User,
  ): Promise<PromptModel> {
    return this.marketplace.adopt(workspaceId, user.id, body.promptId);
  }
}
