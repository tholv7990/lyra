import type { BrowserPlatform } from './dto';
import { uploadTikTok } from './scripts/tiktok.upload';
import { uploadYouTube } from './scripts/youtube.upload';

export interface UploadJob {
  mediaPaths: string[]; // local file paths (already downloaded)
  caption: string;
  dryRun: boolean;
}

// Page is `unknown` here — the platform scripts narrow it to a minimal UiPage (pw.ts).
// Playwright is a dynamic (optional) dep, so we don't import its real types.
export type Page = unknown;

interface PwContext {
  pages(): Page[];
  newPage(): Promise<Page>;
}
interface PwBrowser {
  contexts(): PwContext[];
  newContext(): Promise<PwContext>;
  close(): Promise<void>;
}
interface PwChromium {
  connectOverCDP(url: string): Promise<PwBrowser>;
}

const SCRIPTS: Record<BrowserPlatform, (page: Page, job: UploadJob) => Promise<string>> = {
  tiktok: uploadTikTok,
  youtube: uploadYouTube,
};

// Attach Playwright to the GoLogin profile's CDP endpoint and run the platform's
// upload script. Returns a human-readable note (we can't reliably scrape a post URL).
export async function runUpload(wsUrl: string, platform: BrowserPlatform, job: UploadJob): Promise<string> {
  const spec: string = 'playwright'; // typed string → not resolved at build time
  let chromium: PwChromium;
  try {
    chromium = ((await import(spec)) as { chromium: PwChromium }).chromium;
  } catch {
    throw new Error(
      'browser connector: `playwright` not installed — run `pnpm --filter @lyra/connectors-service add playwright`',
    );
  }
  const browser = await chromium.connectOverCDP(wsUrl);
  try {
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    return await SCRIPTS[platform](page, job);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
