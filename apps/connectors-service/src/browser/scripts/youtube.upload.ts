import type { UploadJob } from '../puppeteer.runner';
import type { PuppetPage } from '../puppet';

// ⚠️ EXPERIMENTAL · ToS-RISK · OWN-ACCOUNTS-ONLY
// Best-effort Puppeteer automation of YouTube Studio's upload dialog. Studio is a
// deeply-nested web-component app; selectors here WILL drift and the flow has several
// async steps (processing, checks) — re-verify against the live UI and expect to tune.
// Scaffold to iterate on, not a supported integration.
export async function uploadYouTube(page: PuppetPage, job: UploadJob): Promise<string> {
  await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded' });

  // Studio mounts a hidden file input; if not present you may need to open
  // Create ▸ Upload videos first (a web-component menu) — verify against the live UI.
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30_000 });
  if (!fileInput) throw new Error('YouTube: file input not found (open Create ▸ Upload first?)');
  await fileInput.uploadFile(...job.mediaPaths);

  // Title box (Studio prefills from filename) — overwrite with the caption. Verify selector.
  const title = await page.waitForSelector('#title-textarea #textbox', { timeout: 60_000, visible: true });
  if (!title) throw new Error('YouTube: title box not found (UI changed?)');
  await title.click();
  await title.type(job.caption, { delay: 10 });

  if (job.dryRun) return 'dry-run: YouTube upload dialog reached, file+title set, NOT published';

  // The remaining Studio wizard (Details ▸ … ▸ Visibility=Public ▸ Publish) needs
  // tuning against the live flow — deliberately left as a dry stop.
  return 'YouTube: file uploaded + title set — finish/publish steps need tuning (left as dry stop)';
}
