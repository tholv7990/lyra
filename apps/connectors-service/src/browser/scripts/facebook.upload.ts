import type { UploadJob } from '../puppeteer.runner';
import { sleep, type PuppetPage } from '../puppet';

// ⚠️ EXPERIMENTAL · ToS-RISK · OWN-ACCOUNTS-ONLY
// Best-effort Puppeteer automation of Facebook's web composer (personal feed). FB's
// DOM is heavily obfuscated and aria-label-driven, and FB aggressively detects
// automation (checkpoints/2FA) — re-verify EVERY selector against the live UI.
// To post to a Page, navigate to the Page URL first instead of the home feed.
export async function uploadFacebook(page: PuppetPage, job: UploadJob): Promise<string> {
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });

  // Open the composer dialog — accessible name varies by locale, verify.
  const create = await page.waitForSelector('::-p-aria([name="Create a post"][role="button"])', { timeout: 30_000 });
  if (!create) throw new Error('Facebook: composer trigger not found (UI changed?)');
  await create.click();

  // Reveal the Photo/Video file input — verify.
  const addMedia = await page.waitForSelector('::-p-aria([name="Photo/video"][role="button"])', { timeout: 20_000 });
  if (!addMedia) throw new Error('Facebook: Photo/video button not found (UI changed?)');
  await addMedia.click();
  const fileInput = await page.waitForSelector('div[role="dialog"] input[type="file"]', { timeout: 20_000 });
  if (!fileInput) throw new Error('Facebook: file input not found');
  await fileInput.uploadFile(...job.mediaPaths);

  // Caption is a contenteditable inside the dialog — verify.
  const caption = await page.waitForSelector('div[role="dialog"] div[contenteditable="true"]', { timeout: 30_000, visible: true });
  if (caption) {
    await caption.click();
    await caption.type(job.caption, { delay: 10 });
  }

  if (job.dryRun) return 'dry-run: Facebook composer reached, media+caption set, NOT posted';

  const post = await page.waitForSelector('::-p-aria([name="Post"][role="button"])', { timeout: 20_000 });
  if (!post) throw new Error('Facebook: Post button not found (UI changed?)');
  await post.click();
  await sleep(6_000);
  return 'Facebook: post clicked — confirm in Facebook (UI automation is best-effort)';
}
