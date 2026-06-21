import type { UploadJob, Page } from '../playwright.runner';
import type { UiPage } from '../pw';

// ⚠️ EXPERIMENTAL · ToS-RISK · OWN-ACCOUNTS-ONLY
// Best-effort UI automation of TikTok's web uploader. TikTok changes this UI often
// and actively discourages automation — treat EVERY selector below as something to
// re-verify against the live page, and expect captcha / "unusual activity" prompts.
// This is a scaffold to iterate on, not a supported or reliable integration.
export async function uploadTikTok(page: Page, job: UploadJob): Promise<string> {
  const pg = page as UiPage;
  await pg.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });

  // File input (often hidden / inside the uploader component) — verify selector.
  const fileInput = pg.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles(job.mediaPaths);

  // Caption is a contenteditable, not a textarea — verify selector.
  const caption = pg.locator('div[contenteditable="true"]').first();
  await caption.waitFor({ state: 'visible', timeout: 60_000 });
  await caption.click();
  await caption.fill(job.caption);

  if (job.dryRun) return 'dry-run: TikTok upload page reached, file+caption set, NOT submitted';

  // Publish button label varies by locale — verify.
  await pg.getByRole('button', { name: /^post$/i }).click({ timeout: 30_000 });
  await pg.waitForTimeout(8_000);
  return 'TikTok: submit clicked — confirm in TikTok (UI automation is best-effort)';
}
