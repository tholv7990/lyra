import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PublishJob } from '@lyra/shared';
import { safeFetch } from '../common/safe-fetch';
import { JobStore } from '../publish/job-store';
import { browserConfig, type BrowserConfig } from './browser.config';
import { startProfile } from './gologin.client';
import { runUpload } from './puppeteer.runner';
import { BROWSER_PLATFORMS, type BrowserPublishBody } from './dto';

// Browser-automation publisher (GoLogin profile + Playwright). FENCED:
// off unless BROWSER_CONNECTOR_ENABLED=true, separate /browser routes, never on the
// Postiz/customer publish path. For posting to your OWN logged-in accounts only.
@Injectable()
export class BrowserService {
  readonly cfg: BrowserConfig;
  private readonly store = new JobStore(900_000);

  constructor(config: ConfigService) {
    this.cfg = browserConfig(config);
    setInterval(() => this.store.sweep(), 60_000).unref();
  }

  status() {
    return {
      enabled: this.cfg.enabled,
      gologinConfigured: !!this.cfg.gologinToken,
      platforms: [...BROWSER_PLATFORMS],
    };
  }

  publish(b: BrowserPublishBody): { jobId: string; status: PublishJob['status'] } {
    const jobId = this.store.create();
    void this.run(jobId, b).catch((e: unknown) =>
      this.store.update(jobId, {
        status: 'failed',
        receipts: [fail(b, e instanceof Error ? e.message : 'failed')],
      }),
    );
    return { jobId, status: 'queued' };
  }

  job(id: string): PublishJob | null {
    return this.store.get(id);
  }

  private async run(jobId: string, b: BrowserPublishBody): Promise<void> {
    this.store.update(jobId, { status: 'running' });
    const dir = await mkdtemp(join(tmpdir(), 'lyra-browser-'));
    try {
      const mediaPaths: string[] = [];
      for (const [i, url] of b.mediaUrls.entries()) {
        const res = await safeFetch(url);
        if (!res.ok) throw new Error(`media fetch ${res.status}`);
        const p = join(dir, `media-${i}`);
        await writeFile(p, Buffer.from(await res.arrayBuffer()));
        mediaPaths.push(p);
      }
      const session = await startProfile(this.cfg.gologinToken, b.profileId);
      try {
        const note = await runUpload(session.wsUrl, b.platform, {
          mediaPaths,
          caption: b.caption,
          dryRun: !!b.dryRun,
        });
        this.store.update(jobId, {
          status: 'done',
          receipts: [{ platform: b.platform, accountId: b.profileId, status: 'ok', error: note }],
        });
      } finally {
        await session.stop();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function fail(b: BrowserPublishBody, message: string) {
  return { platform: b.platform, accountId: b.profileId, status: 'failed' as const, error: message };
}
