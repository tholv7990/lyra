import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProjectProductsController } from './project-products.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';

// Products are workspace-scoped (not project-scoped). WorkspacesModule provides
// WorkspaceGuard + MembershipsService; UsersModule expands actor refs.
// ProjectsModule provides ProjectAccessGuard + ProjectsService for project-scoped routes.
@Module({
  imports: [
    WorkspacesModule,
    UsersModule,
    ProjectsModule, // ProjectAccessGuard + ProjectsService for ProjectProductsController
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ProductsController, ProjectProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
