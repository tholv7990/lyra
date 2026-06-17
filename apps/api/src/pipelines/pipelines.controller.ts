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
import { dedupeTags, type Pipeline as PipelineModel, type User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { PipelinesService } from './pipelines.service';
import { PipelineAccessGuard } from './guards/pipeline-access.guard';
import {
  CurrentPipeline,
  RequirePipelineOwner,
} from './decorators/pipeline.decorators';
import type { PipelineDocument } from './pipeline.schema';
import { CreatePipelineBody, UpdatePipelineBody } from './dto/pipelines.dto';
import { CascadeService } from '../common/database/cascade.service';

@Controller()
export class PipelinesController {
  constructor(
    private readonly pipelines: PipelinesService,
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
    });
    return this.pipelines.toView(pipeline);
  }

  @Get('workspaces/:id/pipelines')
  @UseGuards(WorkspaceGuard)
  async list(@Param('id') workspaceId: string): Promise<PipelineModel[]> {
    return this.pipelines.toViews(await this.pipelines.listForWorkspace(workspaceId));
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
