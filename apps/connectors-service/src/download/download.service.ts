import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import type { MediaItem } from '@lyra/shared';
import { assertSafeUrl } from '../common/url';
import { downloadArgs, mapResolveJson, resolveArgs, runYtDlpRetrying, ytDlpReason } from './ytdlp';
import { FileStore } from './file-store';
import { DownloadJobStore, ServiceDownloadJob } from './download-job-store';

// Write a cookies.txt to a private (0600) temp file for the duration of `fn`, then
// delete it — cookies are session secrets, so they never persist alongside the
// downloaded files. No cookies → run `fn` with no path.
async function withCookies<T>(cookies: string | undefined, fn: (cookiePath?: string) => Promise<T>): Promise<T> {
  if (!cookies) return fn();
  const dir = await mkdtemp(join(tmpdir(), 'lyra-ck-'));
  const path = join(dir, 'cookies.txt');
  await writeFile(path, cookies, { mode: 0o600 });
  try {
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

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

  async resolve(url: string, cookies?: string): Promise<MediaItem[]> {
    assertSafeUrl(url);
    const { stdout } = await withCookies(cookies, (cp) => runYtDlpRetrying(resolveArgs(url, cp)));
    return mapResolveJson(JSON.parse(stdout));
  }

  // Start an async download; returns a jobId the caller polls for live progress.
  // The SSRF guard runs here (sync) so a bad URL fails fast; yt-dlp failures land
  // on the job as status 'error' with the parsed reason.
  startDownload(url: string, indices?: number[], format?: string, cookies?: string): string {
    assertSafeUrl(url);
    const id = this.jobs.create();
    void this.runJob(id, url, indices, format, cookies);
    return id;
  }

  private async runJob(id: string, url: string, indices?: number[], format?: string, cookies?: string): Promise<void> {
    try {
      const dir = await mkdtemp(join(tmpdir(), 'lyra-dl-'));
      await withCookies(cookies, (cp) =>
        runYtDlpRetrying(downloadArgs(url, join(dir, '%(id)s.%(ext)s'), indices, format, cp), 4, 600_000, (pct) =>
          this.jobs.update(id, { pct }),
        ),
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
