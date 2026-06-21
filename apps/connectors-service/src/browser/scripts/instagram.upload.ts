import type { UploadJob } from '../puppeteer.runner';
import { sleep, type PuppetPage } from '../puppet';

// ⚠️ EXPERIMENTAL · ToS-RISK · OWN-ACCOUNTS-ONLY
// Best-effort Puppeteer automation of Instagram web's "New post" flow. The flow is a
// multi-step dialog (select ▸ crop ▸ edit ▸ caption ▸ share); labels are aria-driven
// and drift, and IG detects automation. Re-verify EVERY selector; expect challenges.
export async function uploadInstagram(page: PuppetPage, job: UploadJob): Promise<string> {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

  // Open the create-post flow — name varies ("New post" / "Create"), verify.
  const create = await page.waitForSelector('::-p-aria(New post)', { timeout: 30_000 });
  if (!create) throw new Error('Instagram: New post button not found (UI changed?)');
  await create.click();

  // "Select from computer" reveals the file input — verify.
  const select = await page.waitForSelector('::-p-aria(Select from computer)', { timeout: 20_000 });
  if (select) await select.click();
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 20_000 });
  if (!fileInput) throw new Error('Instagram: file input not found');
  await fileInput.uploadFile(...job.mediaPaths);

  // Crop ▸ Next, then Edit ▸ Next (two "Next" steps) — verify labels.
  for (let step = 1; step <= 2; step++) {
    const next = await page.waitForSelector('::-p-aria([name="Next"][role="button"])', { timeout: 20_000 });
    if (!next) throw new Error(`Instagram: Next button not found at step ${step}`);
    await next.click();
    await sleep(800);
  }

  // Caption box — verify selector (aria-label is locale-dependent).
  const caption = await page.waitForSelector('div[aria-label="Write a caption..."]', { timeout: 20_000, visible: true });
  if (caption) {
    await caption.click();
    await caption.type(job.caption, { delay: 10 });
  }

  if (job.dryRun) return 'dry-run: Instagram composer reached, media+caption set, NOT shared';

  const share = await page.waitForSelector('::-p-aria([name="Share"][role="button"])', { timeout: 20_000 });
  if (!share) throw new Error('Instagram: Share button not found (UI changed?)');
  await share.click();
  await sleep(8_000);
  return 'Instagram: share clicked — confirm in Instagram (UI automation is best-effort)';
}
