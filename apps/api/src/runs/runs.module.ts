import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { KeysModule } from '../keys/keys.module';
import { Run, RunSchema } from './run.schema';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { RunAccessGuard } from './guards/run-access.guard';

@Module({
  imports: [
    WorkspacesModule, // MembershipsService
    ProjectsModule, // ProjectsService + ProjectAccessGuard
    KeysModule, // KeysService (per-step key gating)
    MongooseModule.forFeature([{ name: Run.name, schema: RunSchema }]),
  ],
  controllers: [RunsController],
  providers: [RunsService, RunAccessGuard],
})
export class RunsModule {}
