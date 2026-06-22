import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

interface Entry {
  path: string;
  created: number;
}

@Injectable()
export class RenderStore {
  private readonly map = new Map<string, Entry>();
  private readonly ttlMs = 3600000; // 1 hour

  constructor(private readonly config: ConfigService) {}

  async save(buf: Buffer): Promise<string> {
    const id = randomUUID();
    const path = join(tmpdir(), `${id}.png`);
    await writeFile(path, buf);
    this.map.set(id, { path, created: Date.now() });
    return this.getServeUrl(id);
  }

  get(id: string): string | null {
    return this.map.get(id)?.path ?? null;
  }

  private getServeUrl(id: string): string {
    const publicBase =
      this.config.get<string>('RENDER_SERVICE_PUBLIC_URL') ??
      this.config.get<string>('RENDER_SERVICE_URL') ??
      'http://localhost:9200';
    return `${publicBase}/files/${id}`;
  }
}
