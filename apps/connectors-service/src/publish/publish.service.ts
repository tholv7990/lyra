import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, PublishJob, Receipt } from '@lyra/shared';
import { safeFetch } from '../common/safe-fetch';
import { JobStore } from './job-store';
import * as postiz from './postiz.client';

interface PublishInput { channelIds: string[]; caption: string; mediaUrls: string[] }

@Injectable()
export class PublishService {
  private readonly store: JobStore;
  private readonly base: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.store = new JobStore(Number(config.get('JOB_TTL_MS') ?? 900_000));
    this.base = config.get<string>('POSTIZ_API_URL') ?? '';
    this.publicUrl = config.get<string>('POSTIZ_PUBLIC_URL') ?? '';
    setInterval(() => this.store.sweep(), 60_000).unref();
  }

  connectUrl(): { url: string } {
    return { url: this.publicUrl || '#postiz' };
  }

  async channels(key: string): Promise<Channel[]> {
    return postiz.mapIntegrations(await postiz.listIntegrations(this.base, key));
  }

  publish(key: string, input: PublishInput): { jobId: string; status: PublishJob['status'] } {
    const jobId = this.store.create();
    void this.runPublish(jobId, key, input).catch(() =>
      this.store.update(jobId, { status: 'failed', receipts: [] }),
    );
    return { jobId, status: 'queued' };
  }

  job(id: string): PublishJob | null {
    return this.store.get(id);
  }

  // Resolve channels → upload media once → post per channel (partial-failure
  // tolerant) → receipts. Exposed for unit tests; runs in the background from publish().
  async runPublish(jobId: string, key: string, input: PublishInput): Promise<void> {
    this.store.update(jobId, { status: 'running' });
    const all = await this.channels(key);
    const targets = input.channelIds
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is Channel => !!c);

    const media: postiz.UploadResult[] = [];
    for (const url of input.mediaUrls) {
      const res = await safeFetch(url);
      if (!res.ok) throw new Error(`media fetch ${res.status}`);
      const mime = res.headers.get('content-type') ?? 'application/octet-stream';
      const bytes = new Uint8Array(await res.arrayBuffer());
      media.push(await postiz.uploadMedia(this.base, key, bytes, filenameFromUrl(url), mime));
    }

    const receipts: Receipt[] = [];
    for (const ch of targets) {
      try {
        const json = await postiz.createPost(this.base, key, ch.id, input.caption, media);
        receipts.push(postiz.okReceipt(ch, json));
      } catch (e) {
        receipts.push(postiz.failReceipt(ch, e instanceof Error ? e.message : 'post failed'));
      }
    }
    this.store.update(jobId, { status: 'done', receipts });
  }
}

function filenameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split('/').pop() || 'media';
  } catch {
    return 'media';
  }
}
