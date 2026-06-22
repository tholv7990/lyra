import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { ConnectorCredentialInfo, CrawlerCookieInfo, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { ConnectorsProxy, rewriteDownload } from './connectors.proxy';
import { ConnectorCredentialsService } from './connector-credentials.service';
import { CrawlerCookiesService } from './crawler-cookies.service';
import { DownloadBody, PublishBody, ResolveBody, SaveCredentialBody, SetCookiesBody } from './dto/connectors.dto';

const POSTIZ = 'postiz';

// Thin proxy to the connectors microservice (or its mock). Read + run actions are
// member-level; managing credentials requires canManageKeys. The Postiz key is
// stored here (encrypted) and forwarded to the service as X-Connector-Key.
@Controller('workspaces/:id/connectors')
@UseGuards(WorkspaceGuard)
export class ConnectorsController {
  constructor(
    private readonly proxy: ConnectorsProxy,
    private readonly credentials: ConnectorCredentialsService,
    private readonly cookies: CrawlerCookiesService,
  ) {}

  @Put('credentials')
  @RequireManageKeys()
  saveCredential(
    @Param('id') ws: string,
    @CurrentUser() u: User,
    @Body() b: SaveCredentialBody,
  ): Promise<ConnectorCredentialInfo> {
    return this.credentials.upsert(ws, b.connector, b.apiKey, u.id);
  }

  @Get('credentials')
  credentialStatus(@Param('id') ws: string): Promise<ConnectorCredentialInfo> {
    return this.credentials.status(ws, POSTIZ);
  }

  @Get('credentials/apify')
  apifyStatus(@Param('id') ws: string): Promise<ConnectorCredentialInfo> {
    return this.credentials.status(ws, 'apify');
  }

  @Get('connect-link')
  @RequireManageKeys()
  connectLink(@Param('id') ws: string, @CurrentUser() u: User, @Query('connector') connector: string) {
    return this.proxy.forward(ws, u.id, 'GET', `connect-link?connector=${encodeURIComponent(connector ?? '')}`);
  }

  @Get('channels')
  async channels(@Param('id') ws: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', 'channels', undefined, await this.requireKey(ws));
  }

  @Post('publish')
  @RequireCreate()
  async publish(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: PublishBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'publish', b, await this.requireKey(ws));
  }

  @Get('jobs/:jobId')
  async job(@Param('id') ws: string, @Param('jobId') j: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', `jobs/${j}`, undefined, await this.requireKey(ws));
  }

  // Crawler probe + fetch. Viewer-accessible on purpose: these forward NO metered key
  // (yt-dlp runs on the connectors service); only publish spends, so it stays gated.
  @Post('resolve')
  async resolve(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: ResolveBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'resolve', await this.withCookies(ws, b));
  }

  @Post('download')
  async download(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: DownloadBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'download', await this.withCookies(ws, b)); // -> { jobId }
  }

  // --- Crawler cookies (logged-in / age-gated downloads). Stored encrypted, never
  // returned. Upload/remove require canManageKeys; status is member-level. ---
  @Put('cookies')
  @RequireManageKeys()
  setCookies(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: SetCookiesBody): Promise<CrawlerCookieInfo> {
    return this.cookies.set(ws, b.cookies, u.id);
  }

  @Get('cookies')
  cookieStatus(@Param('id') ws: string): Promise<CrawlerCookieInfo> {
    return this.cookies.status(ws);
  }

  @Delete('cookies')
  @RequireManageKeys()
  async removeCookies(@Param('id') ws: string, @CurrentUser() u: User): Promise<CrawlerCookieInfo> {
    await this.cookies.remove(ws, u.id);
    return { present: false };
  }

  // Merge the workspace's decrypted cookies.txt into a resolve/download body so the
  // microservice can pass it to yt-dlp. Absent → unchanged. The cookie is a secret:
  // it only ever flows server-to-server (never back to the browser, never logged).
  private async withCookies(ws: string, body: object): Promise<object> {
    const cookies = await this.cookies.getDecrypted(ws);
    return cookies ? { ...body, cookies } : body;
  }

  // Poll a download job; once done, rewrite the service's fileIds to browser file URLs.
  @Get('download-jobs/:jobId')
  async downloadJob(@Param('id') ws: string, @Param('jobId') j: string, @CurrentUser() u: User) {
    const raw = await this.proxy.forward(ws, u.id, 'GET', `download-jobs/${j}`);
    return raw.status === 'done' && raw.items ? { ...raw, ...rewriteDownload(ws, raw as never) } : raw;
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

  // Resolve the workspace's decrypted Postiz key. In real mode a missing key is a
  // friendly 400 (no keyless call); in mock mode the key is unused, so return
  // undefined and let the proxy serve mock data.
  private async requireKey(ws: string): Promise<string | undefined> {
    const key = await this.credentials.getDecrypted(ws, POSTIZ);
    if (this.proxy.usesService() && !key) {
      throw new BadRequestException('Connect Postiz first — add your API key in Connections.');
    }
    return key ?? undefined;
  }
}
