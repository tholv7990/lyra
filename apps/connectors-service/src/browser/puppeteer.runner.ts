import type { BrowserPlatform } from './dto';
import type { PuppetPage } from './puppet';
import { uploadTikTok } from './scripts/tiktok.upload';
import { uploadYouTube } from './scripts/youtube.upload';

export interface UploadJob {
  mediaPaths: string[]; // local file paths (already downloaded)
  caption: string;
  dryRun: boolean;
}

interface PuppetBrowser {
  pages(): Promise<PuppetPage[]>;
  newPage(): Promise<PuppetPage>;
  disconnect(): Promise<void>;
}
interface Puppeteer {
  connect(opts: { browserWSEndpoint: string }): Promise<PuppetBrowser>;
}

const SCRIPTS: Record<BrowserPlatform, (page: PuppetPage, job: UploadJob) => Promise<string>> = {
  tiktok: uploadTikTok,
  youtube: uploadYouTube,
};

// Attach Puppeteer to the GoLogin profile's CDP endpoint and run the platform's
// upload script. We `disconnect` (not close) — GoLogin owns the browser lifecycle
// and stops it via its own SDK (see gologin.client.ts).
export async function runUpload(wsUrl: string, platform: BrowserPlatform, job: UploadJob): Promise<string> {
  const spec: string = 'puppeteer-core'; // typed string → not resolved at build time
  let puppeteer: Puppeteer;
  try {
    const mod = (await import(spec)) as { default?: Puppeteer } & Partial<Puppeteer>;
    puppeteer = (mod.default ?? (mod as Puppeteer));
  } catch {
    throw new Error(
      'browser connector: `puppeteer-core` not installed — run `pnpm --filter @lyra/connectors-service add puppeteer-core`',
    );
  }
  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
  try {
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
    return await SCRIPTS[platform](page, job);
  } finally {
    await browser.disconnect().catch(() => undefined);
  }
}
