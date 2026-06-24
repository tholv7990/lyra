import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';
import { ProductImportService } from './product-import.service';
import { ProductsController } from './products.controller';
import { ProjectProductsController } from './project-products.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { KeysModule } from '../keys/keys.module';
import { FirecrawlClient } from '../runs/providers/firecrawl.client';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../runs/providers/openai-compat.client';

// Products are workspace-scoped (not project-scoped). WorkspacesModule provides
// WorkspaceGuard + MembershipsService; UsersModule expands actor refs.
// ProjectsModule provides ProjectAccessGuard + ProjectsService for project-scoped routes.
@Module({
  imports: [
    WorkspacesModule,
    UsersModule,
    ProjectsModule, // ProjectAccessGuard + ProjectsService for ProjectProductsController
    ConnectorsModule, // ConnectorCredentialsService (Firecrawl key) for the URL importer
    KeysModule, // KeysService (AI provider key) for the URL importer
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ProductsController, ProjectProductsController],
  // ProductImportService + the zero-dependency LLM/Firecrawl clients are provided
  // standalone here — NOT via RunsModule (RunsModule imports ProductsModule, so
  // importing it back would be circular).
  providers: [ProductsService, ProductImportService, FirecrawlClient, AnthropicClient, OpenAiCompatClient],
  exports: [ProductsService],
})
export class ProductsModule {}
