// Targeted capture of the data-dependent DETAIL screens the main sweep missed
// (they navigate via href / open a sidebar, not the generic card selectors).
// Reuses the saved session from capture-screens.mjs. Run after that one:
//   node scripts/capture-details.mjs
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(new URL('../.ds-sync/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const OUT = 'docs/redesign-screens';
const AUTH = 'scripts/.auth-state.json';
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const EMAIL = process.env.CAPTURE_EMAIL, PASSWORD = process.env.CAPTURE_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set CAPTURE_EMAIL / CAPTURE_PASSWORD — saved sessions go stale (refresh-token rotation).'); process.exit(1); }

async function settle(p) { try { await p.waitForLoadState('networkidle', { timeout: 6000 }); } catch {} await wait(500); }
async function shoot(p, name) {
  await p.setViewportSize(DESKTOP); await wait(300); await p.screenshot({ path: `${OUT}/${name}.desktop.png`, fullPage: true }); console.log('  ✓', name + '.desktop');
  await p.setViewportSize(MOBILE); await wait(400); await p.screenshot({ path: `${OUT}/${name}.mobile.png`, fullPage: true }); console.log('  ✓', name + '.mobile');
  await p.setViewportSize(DESKTOP);
}
async function clickAny(p, sels) {
  for (const s of sels) { const el = p.locator(s).first(); try { if (await el.count() && await el.isVisible()) { await el.click({ timeout: 3000 }); return true; } } catch {} }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.setViewportSize(DESKTOP);
  // Fresh login (storageState goes stale via refresh-token rotation).
  await p.goto(BASE + '/login'); await settle(p);
  await p.fill('input[type="email"]', EMAIL);
  await p.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    p.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 }).catch(() => {}),
    p.locator('form button[type="submit"], form .btn-primary').first().click(),
  ]);
  await settle(p);
  if (p.url().includes('/login')) { console.error('Login failed — check credentials.'); process.exit(1); }
  console.log('· logged in');

  // project-detail → task-detail
  try {
    await p.goto(BASE + '/projects'); await settle(p);
    await p.waitForSelector('button.mkt-card-title', { timeout: 8000 }).catch(() => {});
    if (await clickAny(p, ['button.mkt-card-title', 'button.pr-open', 'a:has-text("Open")'])) {
      await settle(p);
      if (/\/projects\/[^/]+$/.test(p.url())) { await shoot(p, 'project-detail'); }
      // task inside the project
      if (await clickAny(p, ['.tcard-name', '.tcard', 'a[href*="/tasks/"]'])) {
        await settle(p);
        if (/\/tasks\//.test(p.url())) await shoot(p, 'task-detail');
        else console.log('  - task-detail (no task link)');
      } else console.log('  - task-detail (no task)');
    } else console.log('  - project-detail (no project)');
  } catch (e) { console.log('  ✗ project-detail', String(e.message).split('\n')[0]); }

  // pipeline-builder (populated)
  try {
    await p.goto(BASE + '/pipelines'); await settle(p);
    await p.waitForSelector('button.mkt-card-title', { timeout: 8000 }).catch(() => {});
    if (await clickAny(p, ['button.mkt-card-title', 'button.pl-open', 'a:has-text("Open")'])) {
      await settle(p);
      if (/\/pipelines\/[^/]+$/.test(p.url())) await shoot(p, 'pipeline-builder');
      else console.log('  - pipeline-builder (no nav)');
    } else console.log('  - pipeline-builder (no pipeline)');
  } catch (e) { console.log('  ✗ pipeline-builder', String(e.message).split('\n')[0]); }

  // product-detail (opens a sidebar/modal on card click)
  try {
    await p.goto(BASE + '/products'); await settle(p);
    const before = p.url();
    if (await clickAny(p, ['[draggable="true"]', '[class*="prodcard"]', '[class*="product-card"]', '[class*="card"]'])) {
      await wait(800);
      // capture whether a sidebar/dialog opened or URL changed
      await shoot(p, 'product-detail');
    } else console.log('  - product-detail (no product card)');
    if (p.url() !== before) {} // best-effort
  } catch (e) { console.log('  ✗ product-detail', String(e.message).split('\n')[0]); }

  // prompt-edit (the editor in edit mode; click a prompt's Edit/Open)
  try {
    await p.goto(BASE + '/prompts'); await settle(p);
    if (await clickAny(p, ['a[href^="/prompts/"]:not([href$="/new"])', 'button[title*="Edit" i]', 'a:has-text("Edit")'])) {
      await settle(p);
      if (/\/prompts\/[^/]+$/.test(p.url())) await shoot(p, 'prompt-edit');
      else console.log('  - prompt-edit (opened modal, not editor — prompt-new covers the editor)');
    }
  } catch (e) { console.log('  ✗ prompt-edit', String(e.message).split('\n')[0]); }

  await ctx.close(); await browser.close();
  console.log('\nDone → ' + OUT + '/');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
