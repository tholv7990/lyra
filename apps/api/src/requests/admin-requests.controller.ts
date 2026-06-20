import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RequestStatus, RequestType, type User, type UserRequest } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../admin/admin.guard';
import { RequestsService } from './requests.service';
import { UpdateRequestStatusBody } from './dto/requests.dto';

// Super-admin triage. Guarded by the global JwtAuthGuard (authenticates) +
// AdminGuard (env allowlist), mirroring AdminUsersController.
@Controller('admin/requests')
@UseGuards(AdminGuard)
export class AdminRequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  list(@Query('type') type?: string, @Query('status') status?: string): Promise<UserRequest[]> {
    return this.requests.listForAdmin({
      type: isType(type) ? type : undefined,
      status: isStatus(status) ? status : undefined,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateRequestStatusBody,
    @CurrentUser() user: User,
  ): Promise<UserRequest> {
    return this.requests.updateStatus(id, body, user.id);
  }
}

function isType(v?: string): v is RequestType {
  return !!v && (Object.values(RequestType) as string[]).includes(v);
}
function isStatus(v?: string): v is RequestStatus {
  return !!v && (Object.values(RequestStatus) as string[]).includes(v);
}
