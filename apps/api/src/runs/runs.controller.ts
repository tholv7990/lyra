import {
  Body,
  Controller,
  Get,
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
import { RunsService } from './runs.service';
import { RunAccessGuard } from './guards/run-access.guard';
import { CurrentRun } from './decorators/current-run.decorator';
import type { RunDocument } from './run.schema';
import { UpdatePromptBody } from './dto/runs.dto';
import { toRun } from './run.views';

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

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
    return toRun(run);
  }

  @Get('projects/:id/runs')
  @UseGuards(ProjectAccessGuard)
  async list(@CurrentProject() project: ProjectDocument): Promise<RunModel[]> {
    const runs = await this.runs.listForProject(project._id.toString());
    return runs.map(toRun);
  }

  @Get('runs/:id')
  @UseGuards(RunAccessGuard)
  get(@CurrentRun() run: RunDocument): RunModel {
    return toRun(run);
  }

  @Patch('runs/:id/steps/:i/prompt')
  @UseGuards(RunAccessGuard)
  async setPrompt(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @Body() body: UpdatePromptBody,
  ): Promise<RunModel> {
    return toRun(await this.runs.updatePrompt(run, i, body.prompt));
  }

  @Post('runs/:id/steps/:i/run')
  @UseGuards(RunAccessGuard)
  async runStep(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
  ): Promise<RunModel> {
    return toRun(await this.runs.runStep(run, i));
  }

  @Post('runs/:id/steps/:i/approve')
  @UseGuards(RunAccessGuard)
  async approve(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
  ): Promise<RunModel> {
    return toRun(await this.runs.approveGate(run, i));
  }

  @Post('runs/:id/run-all')
  @UseGuards(RunAccessGuard)
  async runAll(@CurrentRun() run: RunDocument): Promise<RunModel> {
    return toRun(await this.runs.runAll(run));
  }

  @Post('runs/:id/stop')
  @UseGuards(RunAccessGuard)
  async stop(@CurrentRun() run: RunDocument): Promise<RunModel> {
    return toRun(await this.runs.stop(run));
  }

  @Post('runs/:id/reset')
  @UseGuards(RunAccessGuard)
  async reset(@CurrentRun() run: RunDocument): Promise<RunModel> {
    return toRun(await this.runs.reset(run));
  }
}
