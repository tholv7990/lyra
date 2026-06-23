import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { Product, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { CurrentProject } from '../projects/decorators/project.decorators';
import type { ProjectDocument } from '../projects/project.schema';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { ProductsService } from './products.service';
import { SelectProductBody } from './dto/products.dto';

@Controller()
@UseGuards(ProjectAccessGuard)
export class ProjectProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('projects/:id/products')
  list(@CurrentProject() project: ProjectDocument): Promise<Product[]> {
    return this.products.listForProject(project.workspaceId, project._id.toString());
  }

  @Post('projects/:id/products')
  @RequireCreate()
  select(
    @CurrentProject() project: ProjectDocument,
    @Body() body: SelectProductBody,
    @CurrentUser() user: User,
  ): Promise<Product> {
    return this.products.selectIntoProject(project.workspaceId, project._id.toString(), body.poolProductId, user.id);
  }

  @Post('projects/:id/products/:copyId/refresh')
  @RequireCreate()
  refresh(
    @CurrentProject() project: ProjectDocument,
    @Param('copyId') copyId: string,
    @CurrentUser() user: User,
  ): Promise<Product> {
    return this.products.refreshCopy(copyId, project.workspaceId, project._id.toString(), user.id);
  }

  @Delete('projects/:id/products/:copyId')
  @RequireCreate()
  @HttpCode(204)
  async unselect(
    @CurrentProject() project: ProjectDocument,
    @Param('copyId') copyId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.products.unselect(copyId, project.workspaceId, project._id.toString(), user.id);
  }
}
