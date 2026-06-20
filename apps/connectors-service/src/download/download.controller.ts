import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { DownloadService } from './download.service';
import { DownloadBody, ResolveBody } from './dto';
import { ytDlpReason } from './ytdlp';

// Map a yt-dlp failure to a clean 4xx carrying the real reason, so Lyra's proxy
// forwards it to the UI instead of a generic 500. Real HttpExceptions (e.g. the
// SSRF guard's 400) pass through unchanged.
function asHttp(err: unknown): HttpException {
  return err instanceof HttpException ? err : new UnprocessableEntityException(ytDlpReason(err));
}

@Controller()
@UseGuards(ServiceTokenGuard)
export class DownloadController {
  constructor(private readonly svc: DownloadService) {}

  @Post('resolve')
  async resolve(@Body() b: ResolveBody) {
    try {
      return { items: await this.svc.resolve(b.url, b.cookies) };
    } catch (err) {
      throw asHttp(err);
    }
  }

  @Post('download')
  download(@Body() b: DownloadBody) {
    try {
      return { jobId: this.svc.startDownload(b.url, b.indices, b.format, b.cookies) };
    } catch (err) {
      throw asHttp(err); // SSRF guard (sync); yt-dlp failures land on the job, not here
    }
  }

  @Get('download-jobs/:id')
  job(@Param('id') id: string) {
    return this.svc.job(id) ?? { jobId: id, status: 'error', pct: 0, error: 'job expired or not found' };
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
