import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CompetitorStatus } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@lyra/shared';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { MonitorService } from './monitor.service';
import { DiscoverBody } from './dto/monitor.dto';

@Controller('workspaces/:id/monitor')
@UseGuards(WorkspaceGuard)
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('competitors')
  list(@Param('id') ws: string, @Query('status') status?: CompetitorStatus) { return this.monitor.list(ws, status); }

  @Post('discover')
  @RequireCreate()
  discover(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: DiscoverBody) { return this.monitor.discover(ws, u.id, b.keywords); }

  @Post('competitors/:cid/approve')
  @RequireCreate()
  approve(@Param('id') ws: string, @Param('cid') cid: string) { return this.monitor.approve(ws, cid); }

  @Post('competitors/:cid/reject')
  @RequireCreate()
  reject(@Param('id') ws: string, @Param('cid') cid: string) { return this.monitor.reject(ws, cid); }

  @Delete('competitors/:cid')
  @RequireCreate()
  remove(@Param('id') ws: string, @Param('cid') cid: string) { return this.monitor.remove(ws, cid); }

  @Get('changelog')
  changelog(@Param('id') ws: string, @Query('days') days?: string) { return this.monitor.changelog(ws, Math.min(Number(days) || 7, 30)); }

  @Get('ads')
  ads(@Param('id') ws: string, @Query('competitorId') cid: string) { return this.monitor.adsForCompetitor(ws, cid); }

  @Post('run-now')
  @RequireCreate()
  async runNow(@Param('id') ws: string) { await this.monitor.runDaily(ws); return { ok: true }; }
}
