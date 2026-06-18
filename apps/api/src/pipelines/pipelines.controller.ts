import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  dedupeTags,
  type AiChatResponse,
  type GeneratedPipeline,
  type Pipeline as PipelineModel,
  type User,
} from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { PipelinesService } from './pipelines.service';
import { PipelineAiService } from './pipeline-ai.service';
import { PipelineAccessGuard } from './guards/pipeline-access.guard';
import {
  CurrentPipeline,
  RequirePipelineOwner,
} from './decorators/pipeline.decorators';
import type { PipelineDocument } from './pipeline.schema';
import {
  AiChatBody,
  CreatePipelineBody,
  GeneratePipelineBody,
  UpdatePipelineBody,
} from './dto/pipelines.dto';
import { CascadeService } from '../common/database/cascade.service';

@Controller()
export class PipelinesController {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly pipelineAi: PipelineAiService,
    private readonly cascade: CascadeService,
  ) {}

  // ===== Library =====
  @Post('workspaces/:id/pipelines')
  @UseGuards(WorkspaceGuard)
  async create(
    @Param('id') workspaceId: string,
    @Body() body: CreatePipelineBody,
    @CurrentUser() user: User,
  ): Promise<PipelineModel> {
    const pipeline = await this.pipelines.create({
      workspaceId,
      createdBy: user.id,
      updatedBy: user.id,
      name: body.name,
      description: body.description ?? '',
      tags: dedupeTags(body.tags ?? []),
      steps: this.pipelines.normalizeSteps(body.steps ?? []),
      variables: this.pipelines.normalizeVariables(body.variables ?? []),
      // Provenance — only persisted when the client marks it AI-built.
      ...(body.origin?.source === 'ai'
        ? { origin: { source: 'ai', goal: body.origin.goal, model: body.origin.model } }
        : {}),
    });
    return this.pipelines.toView(pipeline);
  }

  // Design a pipeline from the workspace's prompt library + a goal. Returns a
  // draft (not saved) for the builder to pre-fill; runs on Claude (BYOK).
  @Post('workspaces/:id/pipelines/generate')
  @UseGuards(WorkspaceGuard)
  async generate(
    @Param('id') workspaceId: string,
    @Body() body: GeneratePipelineBody,
  ): Promise<GeneratedPipeline> {
    return this.pipelineAi.generate(workspaceId, body.goal, body.current);
  }

  // Conversational pipeline design — multi-turn. The AI replies in words and,
  // when it has enough, attaches a draft. Same library grounding as generate.
  @Post('workspaces/:id/pipelines/ai-chat')
  @UseGuards(WorkspaceGuard)
  async aiChat(
    @Param('id') workspaceId: string,
    @Body() body: AiChatBody,
  ): Promise<AiChatResponse> {
    return this.pipelineAi.chat(workspaceId, body.messages, body.current);
  }

  @Get('workspaces/:id/pipelines')
  @UseGuards(WorkspaceGuard)
  async list(@Param('id') workspaceId: string): Promise<PipelineModel[]> {
    return this.pipelines.toViews(await this.pipelines.listForWorkspace(workspaceId));
  }

  // How many pipelines reference a given prompt (drives the delete-prompt warning).
  @Get('workspaces/:id/pipelines/prompt-usage/:promptId')
  @UseGuards(WorkspaceGuard)
  async promptUsage(
    @Param('id') workspaceId: string,
    @Param('promptId') promptId: string,
  ): Promise<{ count: number }> {
    return { count: await this.pipelines.countUsingPrompt(workspaceId, promptId) };
  }

  @Get('pipelines/:id')
  @UseGuards(PipelineAccessGuard)
  get(@CurrentPipeline() pipeline: PipelineDocument): Promise<PipelineModel> {
    return this.pipelines.toView(pipeline);
  }

  @Patch('pipelines/:id')
  @UseGuards(PipelineAccessGuard)
  @RequirePipelineOwner()
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePipelineBody,
    @CurrentUser() user: User,
  ): Promise<PipelineModel> {
    const patch: Record<string, unknown> = { updatedBy: user.id };
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.tags !== undefined) patch.tags = dedupeTags(body.tags);
    if (body.steps !== undefined) patch.steps = this.pipelines.normalizeSteps(body.steps);
    if (body.variables !== undefined)
      patch.variables = this.pipelines.normalizeVariables(body.variables);
    const updated = await this.pipelines.findByIdAndUpdate(id, patch);
    return this.pipelines.toView(updated!);
  }

  @Delete('pipelines/:id')
  @UseGuards(PipelineAccessGuard)
  @RequirePipelineOwner()
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.cascade.deletePipeline(id, user.id);
  }
}
