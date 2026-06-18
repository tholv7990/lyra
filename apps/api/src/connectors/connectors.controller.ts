import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { ConnectorsProxy, rewriteDownload } from './connectors.proxy';
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
  async download(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: DownloadBody) {
    const raw = await this.proxy.forward(ws, u.id, 'POST', 'download', b);
    return rewriteDownload(ws, raw as never);
  }

  @Get('files/:fileId')
  async file(@Param('fileId') fileId: string, @Res() res: Response) {
    const r = await this.proxy.streamFile(`files/${fileId}`);
    if (!r.body) { res.status(r.status).end(); return; }
    const cd = r.headers.get('content-disposition');
    if (cd) res.setHeader('Content-Disposition', cd);
    const ct = r.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cl = r.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    Readable.fromWeb(r.body as WebReadableStream).pipe(res);
  }
}
