import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Product, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { ProductsService } from './products.service';
import { CreateProductBody, UpdateProductBody } from './dto/products.dto';

@Controller()
@UseGuards(WorkspaceGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('workspaces/:id/products')
  list(@Param('id') ws: string): Promise<Product[]> { return this.products.list(ws); }

  @Post('workspaces/:id/products')
  @RequireCreate()
  create(@Param('id') ws: string, @Body() body: CreateProductBody, @CurrentUser() user: User): Promise<Product> {
    return this.products.create(ws, user.id, body);
  }

  @Get('workspaces/:id/products/:productId')
  get(@Param('id') ws: string, @Param('productId') productId: string): Promise<Product> { return this.products.get(productId, ws); }

  @Patch('workspaces/:id/products/:productId')
  @RequireCreate()
  update(@Param('id') ws: string, @Param('productId') productId: string, @Body() body: UpdateProductBody, @CurrentUser() user: User): Promise<Product> {
    return this.products.update(productId, ws, user.id, body);
  }

  @Delete('workspaces/:id/products/:productId')
  @RequireCreate()
  @HttpCode(204)
  async remove(@Param('id') ws: string, @Param('productId') productId: string, @CurrentUser() user: User): Promise<void> {
    await this.products.remove(productId, ws, user.id);
  }
}
