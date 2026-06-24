import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { ImportedProduct, Product, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { ProductsService } from './products.service';
import { ProductImportService } from './product-import.service';
import { CreateProductBody, UpdateProductBody, SaveProductResultBody, ImportUrlBody } from './dto/products.dto';

@Controller()
@UseGuards(WorkspaceGuard)
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly importSvc: ProductImportService,
  ) {}

  @Get('workspaces/:id/products')
  list(@Param('id') ws: string): Promise<Product[]> { return this.products.list(ws); }

  @Post('workspaces/:id/products')
  @RequireCreate()
  create(@Param('id') ws: string, @Body() body: CreateProductBody, @CurrentUser() user: User): Promise<Product> {
    return this.products.create(ws, user.id, body);
  }

  // One-time import: crawl an e-commerce URL + LLM-map it into product fields.
  // Returns an UNSAVED ImportedProduct for the Add-product form to prefill.
  // Same gate as create (spends keys/crawls).
  @Post('workspaces/:id/products/import-url')
  @RequireCreate()
  importUrl(@Param('id') ws: string, @Body() body: ImportUrlBody): Promise<ImportedProduct> {
    return this.importSvc.extractFromUrl(ws, body.url);
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

  @Post('workspaces/:id/products/:productId/results')
  @RequireCreate()
  addResult(@Param('id') ws: string, @Param('productId') productId: string, @Body() body: SaveProductResultBody, @CurrentUser() user: User): Promise<Product> {
    return this.products.addResult(productId, ws, user.id, body);
  }

  @Delete('workspaces/:id/products/:productId/results/:resultId')
  removeResult(@Param('id') ws: string, @Param('productId') productId: string, @Param('resultId') resultId: string, @CurrentUser() user: User): Promise<Product> {
    return this.products.removeResult(productId, ws, user.id, resultId);
  }
}
