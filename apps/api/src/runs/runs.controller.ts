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
import type { Asset as AssetModel, Run as RunModel, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { CurrentProject } from '../projects/decorators/project.decorators';
import type { ProjectDocument } from '../projects/project.schema';
import { PipelinesService } from '../pipelines/pipelines.service';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { AssetsService } from '../assets/assets.service';
import { RunsService } from './runs.service';
import { RunAccessGuard } from './guards/run-access.guard';
import { CurrentRun } from './decorators/current-run.decorator';
import type { RunDocument } from './run.schema';
import { RunPipelineBody, UpdatePromptBody } from './dto/runs.dto';

// Merge entered values with the pipeline's variable definitions: only keys the
// pipeline declares are kept; a missing value falls back to the variable default.
function mergeCustomVars(
  defs: { key: string; default?: string }[] = [],
  supplied?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) {
    const v = supplied?.[d.key];
    out[d.key] = typeof v === 'string' ? v : d.default ?? '';
  }
  return out;
}

@Controller()
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    private readonly pipelines: PipelinesService,
    private readonly assets: AssetsService,
  ) {}

  // Create a run by executing a composable pipeline in this project's context.
  @Post('projects/:id/pipelines/:pipelineId/runs')
  @UseGuards(ProjectAccessGuard)
  async createFromPipeline(
    @CurrentProject() project: ProjectDocument,
    @Param('pipelineId') pipelineId: string,
    @Body() body: RunPipelineBody,
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
        projectVariables: Object.fromEntries(
          (project.variables ?? []).map((v) => [v.key, v.value]),
        ),
        note: pipeline.description ?? '',
        variables: mergeCustomVars(pipeline.variables, body.variables),
        collections: body.collections,
        steps: pipeline.steps.map((s) => ({
          name: s.name,
          promptId: s.promptId,
          provider: s.provider,
          model: s.model,
          mode: s.mode,
          fanOut: s.fanOut,
        })),
      },
      user.id,
    );
    return this.runs.toView(run);
  }

  // Test-run a pipeline from the builder — no project. {note} is filled from the
  // pipeline's note; {product}/{niche}/{homepage} stay blank (no project).
  @Post('workspaces/:id/pipelines/:pipelineId/test-runs')
  @UseGuards(WorkspaceGuard)
  async createTestRun(
    @Param('id') workspaceId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() body: RunPipelineBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    const pipeline = await this.pipelines.findActiveById(pipelineId);
    if (!pipeline || pipeline.workspaceId !== workspaceId) {
      throw new NotFoundException('Pipeline not found');
    }
    const run = await this.runs.createForPipeline(
      {
        workspaceId,
        pipelineId: pipeline._id.toString(),
        pipelineName: pipeline.name,
        projectVariables: {},
        note: pipeline.description ?? '',
        variables: mergeCustomVars(pipeline.variables, body.variables),
        collections: body.collections,
        steps: pipeline.steps.map((s) => ({
          name: s.name,
          promptId: s.promptId,
          provider: s.provider,
          model: s.model,
          mode: s.mode,
          fanOut: s.fanOut,
        })),
      },
      user.id,
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

  // Media produced by this run's steps (images/video). Same access as the run.
  @Get('runs/:id/assets')
  @UseGuards(RunAccessGuard)
  async runAssets(@CurrentRun() run: RunDocument): Promise<AssetModel[]> {
    return this.assets.toViews(await this.assets.listForRun(run._id.toString()));
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
