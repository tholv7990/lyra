import type { UploadJob, Page } from '../playwright.runner';
import type { UiPage } from '../pw';

// ⚠️ EXPERIMENTAL · ToS-RISK · OWN-ACCOUNTS-ONLY
// Best-effort UI automation of YouTube Studio's upload dialog. The Studio UI is a
// deeply-nested web-component app; selectors here WILL drift and the flow has several
// async steps (processing, checks) — re-verify against the live UI and expect to tune.
// Scaffold to iterate on, not a supported integration.
export async function uploadYouTube(page: Page, job: UploadJob): Promise<string> {
  const pg = page as UiPage;
  await pg.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded' });

  // Open the upload dialog (Create ▸ Upload videos) — verify selectors/labels.
  await pg.getByRole('button', { name: /create/i }).click({ timeout: 30_000 });
  await pg.getByRole('menuitem', { name: /upload videos?/i }).click({ timeout: 15_000 });

  // The dialog's hidden file input — verify.
  const fileInput = pg.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles(job.mediaPaths);

  // Title field (Studio prefills from filename) — overwrite with the caption.
  const title = pg.locator('#title-textarea #textbox, [aria-label="Add a title"]').first();
  await title.waitFor({ state: 'visible', timeout: 60_000 });
  await title.click();
  await title.fill(job.caption);

  if (job.dryRun) return 'dry-run: YouTube upload dialog reached, file+title set, NOT published';

  // Studio is a multi-step wizard (Details ▸ … ▸ Visibility ▸ Publish). The remaining
  // "Next ×3 → set Public → Publish" steps need tuning against the live flow.
  return 'YouTube: file uploaded + title set — finish/publish steps need tuning (left as dry stop)';
}
