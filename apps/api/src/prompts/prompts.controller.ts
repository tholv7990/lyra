import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { dedupeTags, PromptStatus, PromptType, Provider } from '@lyra/shared';
import type {
  Paged,
  ProviderCount,
  PromptAuthorCount,
  Prompt as PromptModel,
  TagCount,
  User,
} from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { PromptsService } from './prompts.service';
import { PromptAccessGuard } from './guards/prompt-access.guard';
import {
  CurrentPrompt,
  RequirePromptOwner,
} from './decorators/prompt.decorators';
import type { PromptDocument } from './prompt.schema';
import { CreatePromptBody, UpdatePromptBody } from './dto/prompts.dto';

function listQuery(value?: string | string[]): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
}

@Controller()
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Post('workspaces/:id/prompts')
  @UseGuards(WorkspaceGuard)
  async create(
    @Param('id') workspaceId: string,
    @Body() body: CreatePromptBody,
    @CurrentUser() user: User,
  ): Promise<PromptModel> {
    const prompt = await this.prompts.create({
      workspaceId,
      createdBy: user.id,
      updatedBy: user.id,
      title: body.title,
      content: body.content,
      status: body.status ?? PromptStatus.Draft,
      type: body.type ?? PromptType.Text,
      media: body.media ?? [],
      tags: dedupeTags(body.tags ?? []),
      provider: body.provider,
      model: body.model,
    });
    return this.prompts.toView(prompt);
  }

  // Paginated, filterable list (multi status/tag/provider/createdBy, title query q).
  @Get('workspaces/:id/prompts')
  @UseGuards(WorkspaceGuard)
  async list(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
    @Query('status') status?: string | string[],
    @Query('tag') tag?: string | string[],
    @Query('type') type?: string | string[],
    @Query('provider') provider?: string | string[],
    @Query('createdBy') createdBy?: string | string[],
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<Paged<PromptModel>> {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit ?? '12', 10) || 12));
    const statuses = listQuery(status).filter(
      (s): s is PromptStatus => s === PromptStatus.Draft || s === PromptStatus.Public,
    );
    const types = listQuery(type).filter(
      (t): t is PromptType => Object.values(PromptType).includes(t as PromptType),
    );
    const providers = listQuery(provider).filter(
      (p): p is Provider => Object.values(Provider).includes(p as Provider),
    );
    const { items, total } = await this.prompts.listPaged(workspaceId, user.id, {
      statuses,
      tags: listQuery(tag),
      types,
      createdBy: listQuery(createdBy),
      providers,
      q: q || undefined,
      page: p,
      limit: l,
    });
    return { items: await this.prompts.toViews(items), total, page: p, limit: l };
  }

  // The workspace tag vocabulary (visible to the caller) for the picker.
  @Get('workspaces/:id/prompts/tags')
  @UseGuards(WorkspaceGuard)
  tags(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<TagCount[]> {
    return this.prompts.tagVocabulary(workspaceId, user.id);
  }

  @Get('workspaces/:id/prompts/creators')
  @UseGuards(WorkspaceGuard)
  creators(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<PromptAuthorCount[]> {
    return this.prompts.authorVocabulary(workspaceId, user.id);
  }

  // The provider vocabulary (visible to the caller) — drives the stable,
  // full-library provider filter on the Prompts page.
  @Get('workspaces/:id/prompts/providers')
  @UseGuards(WorkspaceGuard)
  providers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<ProviderCount[]> {
    return this.prompts.providerVocabulary(workspaceId, user.id);
  }

  @Get('prompts/:id')
  @UseGuards(PromptAccessGuard)
  get(@CurrentPrompt() prompt: PromptDocument): Promise<PromptModel> {
    return this.prompts.toView(prompt);
  }

  @Patch('prompts/:id')
  @UseGuards(PromptAccessGuard)
  @RequirePromptOwner()
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePromptBody,
    @CurrentUser() user: User,
  ): Promise<PromptModel> {
    const patch: Record<string, unknown> = { ...body, updatedBy: user.id };
    if (body.tags !== undefined) patch.tags = dedupeTags(body.tags);
    const updated = await this.prompts.findByIdAndUpdate(id, patch);
    return this.prompts.toView(updated!);
  }

  @Delete('prompts/:id')
  @UseGuards(PromptAccessGuard)
  @RequirePromptOwner()
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.prompts.softDelete(id, user.id);
  }
}
