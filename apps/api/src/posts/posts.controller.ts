import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import type { PublishedPost, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { ProjectsService } from '../projects/projects.service';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { PostsService } from './posts.service';
import { CreatePublishedPostBody } from './dto/posts.dto';

// Project post history. ProjectAccessGuard (on the project `:id`) enforces view;
// recording a post adds @RequireCreate (not Viewer + verified email).
@Controller()
@UseGuards(ProjectAccessGuard)
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('projects/:id/posts')
  list(@Param('id') projectId: string): Promise<PublishedPost[]> {
    return this.posts.list(projectId);
  }

  @Post('projects/:id/posts')
  @RequireCreate()
  async create(
    @Param('id') projectId: string,
    @Body() body: CreatePublishedPostBody,
    @CurrentUser() user: User,
  ): Promise<PublishedPost> {
    const project = await this.projects.findActiveById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return this.posts.create(projectId, project.workspaceId, user.id, body);
  }
}
