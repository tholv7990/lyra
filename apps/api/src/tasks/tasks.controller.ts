import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Task, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { ProjectsService } from '../projects/projects.service';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskBody, UpdateTaskBody } from './dto/tasks.dto';

// Tasks live under a project. ProjectAccessGuard (on the project `:id`) enforces
// view; mutations add @RequireCreate (not Viewer + verified email).
@Controller()
@UseGuards(ProjectAccessGuard)
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('projects/:id/tasks')
  list(@Param('id') projectId: string): Promise<Task[]> {
    return this.tasks.list(projectId);
  }

  @Post('projects/:id/tasks')
  @RequireCreate()
  async create(
    @Param('id') projectId: string,
    @Body() body: CreateTaskBody,
    @CurrentUser() user: User,
  ): Promise<Task> {
    const project = await this.projects.findActiveById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return this.tasks.create(projectId, project.workspaceId, user.id, body);
  }

  @Get('projects/:id/tasks/:taskId')
  get(@Param('taskId') taskId: string): Promise<Task> {
    return this.tasks.get(taskId);
  }

  @Patch('projects/:id/tasks/:taskId')
  @RequireCreate()
  update(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskBody,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.tasks.update(taskId, user.id, body);
  }

  @Delete('projects/:id/tasks/:taskId')
  @RequireCreate()
  @HttpCode(204)
  async remove(@Param('taskId') taskId: string, @CurrentUser() user: User): Promise<void> {
    await this.tasks.remove(taskId, user.id);
  }
}
