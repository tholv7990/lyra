import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRequest, UserRequestSchema } from './user-request.schema';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { AdminRequestsController } from './admin-requests.controller';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { AdminGuard } from '../admin/admin.guard';
import { WorkspacesModule } from '../workspaces/workspaces.module';

// User requests: a user-facing submit endpoint + the super-admin triage list.
// AdminModule is imported for AdminService (the AdminGuard dependency).
@Module({
  imports: [
    UsersModule, // UsersService.refMap
    AdminModule, // AdminService backs AdminGuard
    WorkspacesModule, // WorkspacesService + MembershipsService for team-upgrade validation
    MongooseModule.forFeature([{ name: UserRequest.name, schema: UserRequestSchema }]),
  ],
  controllers: [RequestsController, AdminRequestsController],
  providers: [RequestsService, AdminGuard],
})
export class RequestsModule {}
