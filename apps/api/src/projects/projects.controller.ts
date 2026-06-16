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
import { ProjectVisibility } from '@lyra/shared';
import type { Project as ProjectModel, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import {
  CurrentMembership,
  RequestMembership,
} from '../workspaces/decorators/current-membership.decorator';
import { ProjectsService } from './projects.service';
import { ProjectAccessGuard } from './guards/project-access.guard';
import {
  CurrentProject,
  RequireProjectEdit,
} from './decorators/project.decorators';
import type { ProjectDocument } from './project.schema';
import { CreateProjectBody, UpdateProjectBody } from './dto/projects.dto';
import { toProject } from './project.views';

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('workspaces/:id/projects')
  @UseGuards(WorkspaceGuard)
  async create(
    @Param('id') workspaceId: string,
    @Body() body: CreateProjectBody,
    @CurrentUser() user: User,
  ): Promise<ProjectModel> {
    const project = await this.projects.create({
      workspaceId,
      createdBy: user.id,
      name: body.name,
      product: body.product,
      niche: body.niche,
      homepageUrl: body.homepageUrl,
      visibility: ProjectVisibility.Private,
      sharedWith: [],
      learnings: [],
    });
    return toProject(project);
  }

  @Get('workspaces/:id/projects')
  @UseGuards(WorkspaceGuard)
  async list(
    @Param('id') workspaceId: string,
    @CurrentMembership() m: RequestMembership,
  ): Promise<ProjectModel[]> {
    const list = await this.projects.listForMember(workspaceId, m);
    return list.map(toProject);
  }

  @Get('projects/:id')
  @UseGuards(ProjectAccessGuard)
  get(@CurrentProject() project: ProjectDocument): ProjectModel {
    return toProject(project);
  }

  @Patch('projects/:id')
  @UseGuards(ProjectAccessGuard)
  @RequireProjectEdit()
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProjectBody,
  ): Promise<ProjectModel> {
    const updated = await this.projects.findByIdAndUpdate(id, body);
    return toProject(updated!);
  }

  @Delete('projects/:id')
  @UseGuards(ProjectAccessGuard)
  @RequireProjectEdit()
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.projects.softDelete(id);
  }
}
