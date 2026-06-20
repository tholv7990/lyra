import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './task.schema';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';

// Tasks = the project board's work units. ProjectsModule provides the access
// guard + project lookup; WorkspacesModule provides MembershipsService for
// assignee validation; UsersModule expands actor/assignee refs.
@Module({
  imports: [
    ProjectsModule,
    WorkspacesModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
