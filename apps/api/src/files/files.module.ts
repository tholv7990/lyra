import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

// File storage (GridFS). Uses the global Mongoose connection via
// @InjectConnection, so no forFeature needed.
@Module({
  imports: [WorkspacesModule], // WorkspaceGuard + MembershipsService
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
