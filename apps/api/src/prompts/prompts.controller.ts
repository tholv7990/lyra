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
import { dedupeTags, PromptStatus, StepKey } from '@lyra/shared';
import type { Prompt as PromptModel, TagCount, User } from '@lyra/shared';
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
      type: body.type,
      status: body.status ?? PromptStatus.Draft,
      media: body.media ?? [],
      tags: dedupeTags(body.tags ?? []),
    });
    return this.prompts.toView(prompt);
  }

  @Get('workspaces/:id/prompts')
  @UseGuards(WorkspaceGuard)
  async list(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
    @Query('type') type?: StepKey,
  ): Promise<PromptModel[]> {
    return this.prompts.toViews(
      await this.prompts.listForMember(workspaceId, user.id, type),
    );
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
