import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublishedPost, PublishedPostSchema } from './post.schema';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';

// Project post history. ProjectsModule provides the access guard + project lookup;
// WorkspacesModule provides MembershipsService (which ProjectAccessGuard needs);
// UsersModule expands the author ref.
@Module({
  imports: [
    ProjectsModule,
    WorkspacesModule,
    UsersModule,
    MongooseModule.forFeature([{ name: PublishedPost.name, schema: PublishedPostSchema }]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
