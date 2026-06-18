import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir } from 'node:fs/promises';
import type { MediaItem } from '@lyra/shared';
import { assertSafeUrl } from '../common/url';
import { downloadArgs, mapResolveJson, resolveArgs, runYtDlp } from './ytdlp';
import { FileStore } from './file-store';

@Injectable()
export class DownloadService {
  private readonly store: FileStore;
  constructor(config: ConfigService) {
    this.store = new FileStore(Number(config.get('FILE_TTL_MS') ?? 900_000));
    setInterval(() => this.store.sweep(), 60_000).unref();
  }

  async resolve(url: string): Promise<MediaItem[]> {
    assertSafeUrl(url);
    const { stdout } = await runYtDlp(resolveArgs(url));
    return mapResolveJson(JSON.parse(stdout));
  }

  async download(url: string, indices?: number[]): Promise<{ fileId: string; filename: string }[]> {
    assertSafeUrl(url);
    const dir = await mkdtemp(join(tmpdir(), 'lyra-dl-'));
    await runYtDlp(downloadArgs(url, join(dir, '%(id)s.%(ext)s'), indices));
    const files = await readdir(dir);
    return files.map((f) => ({ fileId: this.store.put(join(dir, f)), filename: f }));
  }

  pathFor(id: string): string {
    const p = this.store.get(id);
    if (!p) throw new NotFoundException('file expired or not found');
    return p;
  }
}
