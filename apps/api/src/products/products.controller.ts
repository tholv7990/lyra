import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import type { Product, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { ProjectsService } from '../projects/projects.service';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { ProductsService } from './products.service';
import { CreateProductBody, UpdateProductBody } from './dto/products.dto';

// Products live under a project (peer of Task). ProjectAccessGuard enforces view;
// mutations add @RequireCreate (not Viewer + verified email).
@Controller()
@UseGuards(ProjectAccessGuard)
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('projects/:id/products')
  list(@Param('id') projectId: string): Promise<Product[]> {
    return this.products.list(projectId);
  }

  @Post('projects/:id/products')
  @RequireCreate()
  async create(@Param('id') projectId: string, @Body() body: CreateProductBody, @CurrentUser() user: User): Promise<Product> {
    const project = await this.projects.findActiveById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return this.products.create(projectId, project.workspaceId, user.id, body);
  }

  @Get('projects/:id/products/:productId')
  get(@Param('productId') productId: string): Promise<Product> {
    return this.products.get(productId);
  }

  @Patch('projects/:id/products/:productId')
  @RequireCreate()
  update(@Param('productId') productId: string, @Body() body: UpdateProductBody, @CurrentUser() user: User): Promise<Product> {
    return this.products.update(productId, user.id, body);
  }

  @Delete('projects/:id/products/:productId')
  @RequireCreate()
  @HttpCode(204)
  async remove(@Param('productId') productId: string, @CurrentUser() user: User): Promise<void> {
    await this.products.remove(productId, user.id);
  }
}
