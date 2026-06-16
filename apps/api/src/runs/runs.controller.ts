import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Run as RunModel, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { CurrentProject } from '../projects/decorators/project.decorators';
import type { ProjectDocument } from '../projects/project.schema';
import { PipelinesService } from '../pipelines/pipelines.service';
import { RunsService } from './runs.service';
import { RunAccessGuard } from './guards/run-access.guard';
import { CurrentRun } from './decorators/current-run.decorator';
import type { RunDocument } from './run.schema';
import { UpdatePromptBody } from './dto/runs.dto';

@Controller()
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    private readonly pipelines: PipelinesService,
  ) {}

  // Create a run by executing a composable pipeline in this project's context.
  @Post('projects/:id/pipelines/:pipelineId/runs')
  @UseGuards(ProjectAccessGuard)
  async createFromPipeline(
    @CurrentProject() project: ProjectDocument,
    @Param('pipelineId') pipelineId: string,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    const pipeline = await this.pipelines.findActiveById(pipelineId);
    if (!pipeline || pipeline.workspaceId !== project.workspaceId) {
      throw new NotFoundException('Pipeline not found');
    }
    const run = await this.runs.createForPipeline(
      {
        projectId: project._id.toString(),
        workspaceId: project.workspaceId,
        pipelineId: pipeline._id.toString(),
        pipelineName: pipeline.name,
        context: {
          product: project.product,
          niche: project.niche,
          homepageUrl: project.homepageUrl,
        },
        steps: pipeline.steps.map((s) => ({
          name: s.name,
          promptId: s.promptId,
          provider: s.provider,
          model: s.model,
          mode: s.mode,
        })),
      },
      user.id,
    );
    return this.runs.toView(run);
  }

  @Post('projects/:id/runs')
  @UseGuards(ProjectAccessGuard)
  async create(
    @CurrentProject() project: ProjectDocument,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    const run = await this.runs.createForProject(
      project._id.toString(),
      project.workspaceId,
      user.id,
      {
        product: project.product,
        niche: project.niche,
        homepageUrl: project.homepageUrl,
      },
    );
    return this.runs.toView(run);
  }

  @Get('projects/:id/runs')
  @UseGuards(ProjectAccessGuard)
  async list(@CurrentProject() project: ProjectDocument): Promise<RunModel[]> {
    return this.runs.toViews(await this.runs.listForProject(project._id.toString()));
  }

  @Get('runs/:id')
  @UseGuards(RunAccessGuard)
  get(@CurrentRun() run: RunDocument): Promise<RunModel> {
    return this.runs.toView(run);
  }

  @Patch('runs/:id/steps/:i/prompt')
  @UseGuards(RunAccessGuard)
  setPrompt(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @Body() body: UpdatePromptBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.updatePrompt(run, i, body.prompt, user.id);
  }

  @Post('runs/:id/steps/:i/run')
  @UseGuards(RunAccessGuard)
  runStep(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.runStep(run, i, user.id);
  }

  @Post('runs/:id/steps/:i/approve')
  @UseGuards(RunAccessGuard)
  approve(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.approveGate(run, i, user.id);
  }

  @Post('runs/:id/run-all')
  @UseGuards(RunAccessGuard)
  runAll(@CurrentRun() run: RunDocument, @CurrentUser() user: User): Promise<RunModel> {
    return this.runs.runAll(run, user.id);
  }

  @Post('runs/:id/stop')
  @UseGuards(RunAccessGuard)
  stop(@CurrentRun() run: RunDocument, @CurrentUser() user: User): Promise<RunModel> {
    return this.runs.stop(run, user.id);
  }

  @Post('runs/:id/reset')
  @UseGuards(RunAccessGuard)
  reset(@CurrentRun() run: RunDocument, @CurrentUser() user: User): Promise<RunModel> {
    return this.runs.reset(run, user.id);
  }
}
