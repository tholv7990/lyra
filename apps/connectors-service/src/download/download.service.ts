import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import type { MediaItem } from '@lyra/shared';
import { assertSafeUrl } from '../common/url';
import { downloadArgs, mapResolveJson, resolveArgs, runYtDlpRetrying, stripYoutubePlaylist, ytDlpReason } from './ytdlp';
import { sweepOrphanTempDirs } from './temp-sweep';
import { FileStore } from './file-store';
import { DownloadJobStore, ServiceDownloadJob } from './download-job-store';
import { Semaphore } from './concurrency';

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
  // Cap concurrent yt-dlp work so a batch of pasted links queues instead of
  // spawning a process storm. Downloads are heavy (yt-dlp + a CPU-bound ffmpeg
  // merge) so their cap is tighter; resolves are light metadata fetches but are
  // still capped to avoid a burst that trips site rate-limiting / bot checks.
  private readonly downloadLimit: Semaphore;
  private readonly resolveLimit: Semaphore;
  constructor(config: ConfigService) {
    const ttl = Number(config.get('FILE_TTL_MS') ?? 900_000);
    this.store = new FileStore(ttl);
    this.jobs = new DownloadJobStore(ttl);
    this.downloadLimit = new Semaphore(Number(config.get('CRAWLER_MAX_CONCURRENT') ?? 3));
    this.resolveLimit = new Semaphore(Number(config.get('CRAWLER_MAX_RESOLVE') ?? 4));
    void sweepOrphanTempDirs();
    setInterval(() => {
      this.store.sweep();
      this.jobs.sweep();
    }, 60_000).unref();
  }

  async resolve(url: string, cookies?: string): Promise<MediaItem[]> {
    const safe = stripYoutubePlaylist(url);
    assertSafeUrl(safe);
    // Capped + time-boxed: 3 attempts at 60s each, so a slow/hung extraction
    // fails fast instead of holding a slot for the 10-minute default.
    const { stdout } = await this.resolveLimit.run(() =>
      withCookies(cookies, (cp) => runYtDlpRetrying(resolveArgs(safe, cp), 3, 60_000)),
    );
    return mapResolveJson(JSON.parse(stdout));
  }

  // Start an async download; returns a jobId the caller polls for live progress.
  // The SSRF guard runs here (sync) so a bad URL fails fast; yt-dlp failures land
  // on the job as status 'error' with the parsed reason.
  startDownload(url: string, indices?: number[], format?: string, cookies?: string): string {
    const safe = stripYoutubePlaylist(url);
    assertSafeUrl(safe);
    const id = this.jobs.create();
    void this.runJob(id, safe, indices, format, cookies);
    return id;
  }

  private async runJob(id: string, url: string, indices?: number[], format?: string, cookies?: string): Promise<void> {
    try {
      // Held for the whole heavy op (download + merge); excess jobs queue here,
      // staying at 0% until a slot frees.
      const items = await this.downloadLimit.run(async () => {
        const dir = await mkdtemp(join(tmpdir(), 'lyra-dl-'));
        await withCookies(cookies, (cp) =>
          runYtDlpRetrying(downloadArgs(url, join(dir, '%(id)s.%(ext)s'), indices, format, cp), 4, 600_000, (pct) =>
            this.jobs.update(id, { pct }),
          ),
        );
        const files = await readdir(dir);
        return files.map((f) => ({ fileId: this.store.put(join(dir, f)), filename: f }));
      });
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
