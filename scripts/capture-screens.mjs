// One-shot screen capture for the Lyra redesign pack.
// Walks every app route, resolves detail pages by clicking the first card, and
// sweeps each page for SAFE modal/popover triggers (open/add/new/edit/view/
// filter — never delete/run/publish/save), screenshotting desktop + mobile.
//
// Run (the app must be up on :5173):
//   CAPTURE_EMAIL=you@x.com CAPTURE_PASSWORD=secret node scripts/capture-screens.mjs
// or reuse a saved session: first run saves scripts/.auth-state.json, later runs
// reuse it (delete it to re-login). Output → docs/redesign-screens/.
//
// ponytail: safe-trigger sweep is a heuristic (allow/deny by button name) — it
// catches most modals, not all; data-dependent ones (StepResultModal needing a
// finished run) won't open. Add explicit steps to MODAL_STEPS if one is missed.

import { createRequire } from 'node:module';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
const require = createRequire(new URL('../.ds-sync/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5173';
const OUT = 'docs/redesign-screens';
const AUTH = 'scripts/.auth-state.json';
const EMAIL = process.env.CAPTURE_EMAIL;
const PASSWORD = process.env.CAPTURE_PASSWORD;

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

// Static app routes (from App.tsx). Detail/dynamic routes are reached by click.
const PAGES = [
  ['home', '/'], ['projects', '/projects'], ['project-new', '/projects/new'],
  ['prompts', '/prompts'], ['prompt-new', '/prompts/new'], ['marketplace', '/marketplace'],
  ['chats', '/chats'], ['pipelines', '/pipelines'], ['pipeline-new', '/pipelines/new'],
  ['products', '/products'], ['publish', '/publish'], ['import', '/import'],
  ['connections', '/connections'], ['monitor', '/monitor'], ['members', '/members'],
  ['settings', '/settings'], ['admin', '/admin'], ['components', '/components'],
];
const PUBLIC = [['login', '/login'], ['signup', '/signup'], ['forgot-password', '/forgot-password']];

// Click the first card on a list page, capture the detail it lands on.
const DETAILS = [
  ['project-detail', '/projects', '.lib-card a, .lib-card button, [class*=card] a'],
  ['prompt-edit', '/prompts', '.lib-card a, .lib-card button'],
  ['pipeline-builder', '/pipelines', '.lib-card a, .lib-card button, [class*=row] a'],
];

const ALLOW = /(^|\b)(new|add|invite|create|filter|edit|view|detail|details|request|connect|open|manage|assign|tag|key|account|sources?)\b/i;
const DENY = /(delete|remove|revoke|run|publish|research|save|submit|confirm|sign\s?out|log\s?out|logout|reset|send|stop|approve|pay|buy|adopt|copy|sync|start)/i;
const DIALOG = '[role="dialog"], [aria-modal="true"], .dialog-scrim, .dialog, .filter-pop, .lin-menu, .menupick-menu, .ws-pop, [class*=popover], [class*=drawer]';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'modal';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name) {
  try { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('  ✓', name); }
  catch (e) { console.log('  ✗', name, String(e.message).split('\n')[0]); }
}

async function settle(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
  await wait(500);
}

async function sweepModals(page, pageName, pageUrl) {
  const seen = new Set();
  let btns = [];
  try { btns = await page.locator('button, [role="button"], [aria-haspopup]').all(); } catch { return; }
  let opened = 0;
  for (const b of btns) {
    if (opened >= 6) break;
    let nm = '';
    try { nm = (await b.getAttribute('aria-label')) || (await b.getAttribute('title')) || (await b.innerText()) || ''; } catch { continue; }
    nm = nm.trim();
    if (!nm || nm.length > 40 || !ALLOW.test(nm) || DENY.test(nm)) continue;
    try {
      if (!(await b.isVisible())) continue;
      await b.scrollIntoViewIfNeeded({ timeout: 1000 });
      await b.click({ timeout: 1500 });
    } catch { if (page.url() !== pageUrl) { try { await page.goto(pageUrl); await settle(page); } catch {} } continue; }
    // navigated instead of opening a modal? reset and move on.
    if (page.url() !== pageUrl) { try { await page.goto(pageUrl); await settle(page); } catch {} continue; }
    const dlg = page.locator(DIALOG).first();
    try {
      await dlg.waitFor({ state: 'visible', timeout: 1500 });
      let title = '';
      try { title = (await dlg.locator('h1,h2,h3,h4').first().innerText({ timeout: 500 })) || nm; } catch { title = nm; }
      const key = slug(title);
      if (!seen.has(key)) {
        seen.add(key); opened++;
        await wait(300);
        await shoot(page, `${pageName}__modal-${key}`);
      }
    } catch { /* no dialog appeared */ }
    try { await page.keyboard.press('Escape'); await wait(200); } catch {}
    if (page.url() !== pageUrl) { try { await page.goto(pageUrl); await settle(page); } catch {} }
  }
}

async function capturePages(ctx, pages, { modals }) {
  const dp = await ctx.newPage();
  await dp.setViewportSize(DESKTOP);
  const mp = await ctx.newPage();
  await mp.setViewportSize(MOBILE);
  for (const [name, route] of pages) {
    const url = BASE + route;
    try { await dp.goto(url, { waitUntil: 'domcontentloaded' }); await settle(dp); await shoot(dp, `${name}.desktop`); }
    catch (e) { console.log('  ✗', name, 'desktop nav', String(e.message).split('\n')[0]); }
    try { await mp.goto(url, { waitUntil: 'domcontentloaded' }); await settle(mp); await shoot(mp, `${name}.mobile`); } catch {}
    if (modals) { try { await dp.goto(url); await settle(dp); await sweepModals(dp, name, url); } catch {} }
  }
  await dp.close(); await mp.close();
}

async function clickIntoDetails(ctx) {
  const p = await ctx.newPage();
  await p.setViewportSize(DESKTOP);
  for (const [name, list, sel] of DETAILS) {
    try {
      await p.goto(BASE + list); await settle(p);
      const target = p.locator(sel).first();
      if (await target.count() === 0) { console.log('  -', name, '(no list item)'); continue; }
      await target.click({ timeout: 3000 }); await settle(p);
      if (p.url() === BASE + list) { console.log('  -', name, '(no navigation)'); continue; }
      await shoot(p, `${name}.desktop`);
      await p.setViewportSize(MOBILE); await wait(300); await shoot(p, `${name}.mobile`);
      await p.setViewportSize(DESKTOP);
      // task detail: from a project, click first task card
      if (name === 'project-detail') {
        const task = p.locator('[class*=task] a, [class*=task] button, .lib-card a').first();
        if (await task.count()) { try { await task.click({ timeout: 2500 }); await settle(p); if (/tasks\//.test(p.url())) await shoot(p, 'task-detail.desktop'); } catch {} }
      }
    } catch (e) { console.log('  ✗', name, String(e.message).split('\n')[0]); }
  }
  await p.close();
}

async function ensureAuth(browser) {
  // Reuse a saved session if it still lands in the app (not redirected to /login).
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH });
    const p = await ctx.newPage();
    await p.goto(BASE + '/'); await settle(p);
    if (!p.url().includes('/login')) { await p.close(); console.log('· reusing saved session'); return ctx; }
    await p.close(); await ctx.close(); rmSync(AUTH, { force: true });
  }
  if (!EMAIL || !PASSWORD) {
    throw new Error('Not logged in and no CAPTURE_EMAIL/CAPTURE_PASSWORD set. Re-run:\n  CAPTURE_EMAIL=you@x.com CAPTURE_PASSWORD=*** node scripts/capture-screens.mjs');
  }
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + '/login'); await settle(p);
  await p.fill('input[type="email"]', EMAIL);
  await p.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    p.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 }).catch(() => {}),
    p.locator('form button[type="submit"], form .btn-primary').first().click(),
  ]);
  await settle(p);
  if (p.url().includes('/login')) { await p.close(); throw new Error('Login failed — check credentials (the form still shows /login).'); }
  await ctx.storageState({ path: AUTH });
  await p.close();
  console.log('· logged in, session saved');
  return ctx;
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  mkdirSync('scripts', { recursive: true });
  const browser = await chromium.launch();
  // 1) public pages (logged-out context)
  console.log('public pages:');
  const pub = await browser.newContext();
  await capturePages(pub, PUBLIC, { modals: false });
  await pub.close();
  // 2) authed app pages + modals + detail pages
  const ctx = await ensureAuth(browser);
  console.log('app pages + modals:');
  await capturePages(ctx, PAGES, { modals: true });
  console.log('detail pages:');
  await clickIntoDetails(ctx);
  await ctx.close();
  await browser.close();
  console.log(`\nDone → ${OUT}/`);
})().catch((e) => { console.error('\nCAPTURE FAILED:', e.message); process.exit(1); });
