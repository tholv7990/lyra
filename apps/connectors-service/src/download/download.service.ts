import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir } from 'node:fs/promises';
import type { MediaItem } from '@lyra/shared';
import { assertSafeUrl } from '../common/url';
import { downloadArgs, mapResolveJson, resolveArgs, runYtDlp, ytDlpReason } from './ytdlp';
import { FileStore } from './file-store';
import { DownloadJobStore, ServiceDownloadJob } from './download-job-store';

@Injectable()
export class DownloadService {
  private readonly store: FileStore;
  private readonly jobs: DownloadJobStore;
  constructor(config: ConfigService) {
    const ttl = Number(config.get('FILE_TTL_MS') ?? 900_000);
    this.store = new FileStore(ttl);
    this.jobs = new DownloadJobStore(ttl);
    setInterval(() => {
      this.store.sweep();
      this.jobs.sweep();
    }, 60_000).unref();
  }

  async resolve(url: string): Promise<MediaItem[]> {
    assertSafeUrl(url);
    const { stdout } = await runYtDlp(resolveArgs(url));
    return mapResolveJson(JSON.parse(stdout));
  }

  // Start an async download; returns a jobId the caller polls for live progress.
  // The SSRF guard runs here (sync) so a bad URL fails fast; yt-dlp failures land
  // on the job as status 'error' with the parsed reason.
  startDownload(url: string, indices?: number[], format?: string): string {
    assertSafeUrl(url);
    const id = this.jobs.create();
    void this.runJob(id, url, indices, format);
    return id;
  }

  private async runJob(id: string, url: string, indices?: number[], format?: string): Promise<void> {
    try {
      const dir = await mkdtemp(join(tmpdir(), 'lyra-dl-'));
      await runYtDlp(downloadArgs(url, join(dir, '%(id)s.%(ext)s'), indices, format), 600_000, (pct) =>
        this.jobs.update(id, { pct }),
      );
      const files = await readdir(dir);
      const items = files.map((f) => ({ fileId: this.store.put(join(dir, f)), filename: f }));
      this.jobs.update(id, { status: 'done', pct: 100, items });
    } catch (err) {
      this.jobs.update(id, { status: 'error', error: ytDlpReason(err) });
    }
  }

  job(id: string): ServiceDownloadJob | null {
    return this.jobs.get(id);
  }

  pathFor(id: string): string {
    const p = this.store.get(id);
    if (!p) throw new NotFoundException('file expired or not found');
    return p;
  }
}
