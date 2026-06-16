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
import { dedupeTags, PromptStatus } from '@lyra/shared';
import type { Paged, Prompt as PromptModel, TagCount, User } from '@lyra/shared';
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
      media: body.media ?? [],
      tags: dedupeTags(body.tags ?? []),
      provider: body.provider,
      model: body.model,
    });
    return this.prompts.toView(prompt);
  }

  // Paginated, filterable list (status, a single tag, title query q).
  @Get('workspaces/:id/prompts')
  @UseGuards(WorkspaceGuard)
  async list(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<Paged<PromptModel>> {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit ?? '12', 10) || 12));
    const st =
      status === PromptStatus.Draft || status === PromptStatus.Public
        ? (status as PromptStatus)
        : undefined;
    const { items, total } = await this.prompts.listPaged(workspaceId, user.id, {
      status: st,
      tag: tag || undefined,
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
