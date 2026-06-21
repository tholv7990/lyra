import type { UploadJob } from '../puppeteer.runner';
import { sleep, type PuppetPage } from '../puppet';

// ⚠️ EXPERIMENTAL · ToS-RISK · OWN-ACCOUNTS-ONLY
// Best-effort Puppeteer automation of TikTok's web uploader. TikTok changes this UI
// often and actively discourages automation — treat EVERY selector below as something
// to re-verify against the live page, and expect captcha / "unusual activity" prompts.
// Scaffold to iterate on, not a supported or reliable integration.
export async function uploadTikTok(page: PuppetPage, job: UploadJob): Promise<string> {
  await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });

  // File input (often hidden inside the uploader) — verify selector.
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30_000 });
  if (!fileInput) throw new Error('TikTok: file input not found (UI changed?)');
  await fileInput.uploadFile(...job.mediaPaths);

  // Caption is a contenteditable, not a textarea — verify selector.
  const caption = await page.waitForSelector('div[contenteditable="true"]', { timeout: 60_000, visible: true });
  if (!caption) throw new Error('TikTok: caption box not found (UI changed?)');
  await caption.click();
  await caption.type(job.caption, { delay: 15 });

  if (job.dryRun) return 'dry-run: TikTok upload page reached, file+caption set, NOT submitted';

  // Publish button — data-e2e/label varies by locale/version, verify.
  const post = await page.waitForSelector('button[data-e2e="post_video_button"]', { timeout: 30_000 });
  if (!post) throw new Error('TikTok: post button not found (UI changed?)');
  await post.click();
  await sleep(8_000);
  return 'TikTok: submit clicked — confirm in TikTok (UI automation is best-effort)';
}
