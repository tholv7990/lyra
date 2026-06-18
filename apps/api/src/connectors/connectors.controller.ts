import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { ConnectorsProxy } from './connectors.proxy';
import { DownloadBody, PublishBody, ResolveBody, SaveCredentialBody } from './dto/connectors.dto';

// Thin proxy to the connectors microservice (or its mock). Read + run actions are
// member-level; managing credentials/links/channels requires canManageKeys (mirrors
// KeysController). No connector logic here — every handler just forwards.
@Controller('workspaces/:id/connectors')
@UseGuards(WorkspaceGuard)
export class ConnectorsController {
  constructor(private readonly proxy: ConnectorsProxy) {}

  @Put('credentials')
  @RequireManageKeys()
  saveCredential(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: SaveCredentialBody) {
    return this.proxy.forward(ws, u.id, 'PUT', 'credentials', b);
  }

  @Get('connect-link')
  @RequireManageKeys()
  connectLink(@Param('id') ws: string, @CurrentUser() u: User, @Query('connector') connector: string) {
    return this.proxy.forward(ws, u.id, 'GET', `connect-link?connector=${encodeURIComponent(connector ?? '')}`);
  }

  @Get('channels')
  channels(@Param('id') ws: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', 'channels');
  }

  @Delete('channels/:channelId')
  @RequireManageKeys()
  removeChannel(@Param('id') ws: string, @Param('channelId') c: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'DELETE', `channels/${c}`);
  }

  @Post('publish')
  publish(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: PublishBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'publish', b);
  }

  @Get('jobs/:jobId')
  job(@Param('id') ws: string, @Param('jobId') j: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', `jobs/${j}`);
  }

  @Post('resolve')
  resolve(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: ResolveBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'resolve', b);
  }

  @Post('download')
  download(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: DownloadBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'download', b);
  }
}
