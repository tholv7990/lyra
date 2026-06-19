import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserSummary,
  Paged,
  User,
} from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminUsersService } from './admin-users.service';
import { UpdateUserStatusBody } from './dto/admin.dto';

// Super-admin platform Overview + User management. Guarded by the global
// JwtAuthGuard (authenticates) + AdminGuard (env allowlist). All aggregation
// lives in the service; this controller is a thin, validated pass-through.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  // Platform-wide counts + recent signups for the admin dashboard.
  @Get('overview')
  overview(): Promise<AdminOverview> {
    return this.service.getOverview();
  }

  // Paged user list; q matches email/name (case-insensitive), newest first.
  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ): Promise<Paged<AdminUserSummary>> {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = parseInt(limit ?? '', 10);
    return this.service.listUsers({
      page: p,
      limit: Number.isFinite(l) && l > 0 ? l : undefined,
      q: q || undefined,
    });
  }

  // Full admin view of one user (workspaces + created-item usage).
  @Get('users/:id')
  userDetail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.service.getUserDetail(id);
  }

  // Deactivate / reactivate a user. The service blocks self-deactivation.
  @Patch('users/:id')
  setUserActive(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusBody,
    @CurrentUser() admin: User,
  ): Promise<AdminUserSummary> {
    return this.service.setUserActive(id, body.active, admin.id);
  }
}
