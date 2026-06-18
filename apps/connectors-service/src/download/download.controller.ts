import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { DownloadService } from './download.service';
import { DownloadBody, ResolveBody } from './dto';

@Controller()
@UseGuards(ServiceTokenGuard)
export class DownloadController {
  constructor(private readonly svc: DownloadService) {}

  @Post('resolve')
  async resolve(@Body() b: ResolveBody) {
    return { items: await this.svc.resolve(b.url) };
  }

  @Post('download')
  async download(@Body() b: DownloadBody) {
    return { items: await this.svc.download(b.url, b.indices) };
  }

  @Get('files/:id')
  file(@Param('id') id: string, @Res() res: Response) {
    const path = this.svc.pathFor(id);
    const name = basename(path);
    const ascii = name.replace(/["\\]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    const stream = createReadStream(path);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    stream.pipe(res);
  }
}
