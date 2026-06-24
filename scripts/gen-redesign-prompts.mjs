// Expand docs/lyra-redesign-prompts.md into one ready-to-paste prompt per screen,
// each with its screenshot path at the top. Output → docs/redesign-prompts/<slug>.txt.
// Run: node scripts/gen-redesign-prompts.mjs
// ponytail: parses the pack we already wrote (single source of truth) instead of
// duplicating the blocks here.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

const SRC = 'docs/lyra-redesign-prompts.md';
const OUT = 'docs/redesign-prompts';

const MASTER = (screen, block) => `You are RESTYLING one existing screen of Lyra (a web app where dropshipping teams
research winning products and run AI creative pipelines). This is a visual restyle,
NOT a behavior redesign.

DESIGN SYSTEM: use the selected "Lyra Component Library" as the only source of
components and styling. One blue accent (#0075DE), warm-neutral surfaces, system font,
flat with hairlines, full light + dark. Read the library README/conventions first.
Never invent a color, control, or component.

SCREEN: ${screen} — see the attached screenshot (current state).

ABSOLUTE RULE — preserve everything, change only the look:
- Reproduce the screenshot's EXACT information architecture: same sections in the same
  order, same data fields, same controls/actions, same navigation, same copy/labels.
- Do NOT add, remove, rename, reorder, merge, or rewire anything. Every field, button,
  menu, badge, column, and state must still exist and behave identically.
- Change ONLY visual design: hierarchy, spacing, typography, color, component usage,
  alignment, responsive layout.

COMPLETENESS PROTOCOL — follow in order, do not skip step 1:
1. INVENTORY (before designing): from the screenshot + the notes below, list EVERY
   element — each section, data field/label, control (button, dropdown, toggle,
   icon-action, link, input), badge/pill/status, list/table column, and each state.
2. MAP each item to the Lyra component or token it uses (dropdowns -> MenuPicker;
   view=eye / delete=X / add=+ via IconButton; status -> StatusPill; cards -> lib-card;
   dialogs -> Modal/ConfirmDialog; buttons -> btn-primary/ghost/danger; text -> --text-*;
   status colors -> running=primary, awaiting=warning, done=success, error=danger).
3. REDESIGN for desktop (1240px) AND mobile (390px), in light AND dark, keeping each
   item's position and behavior. Keep every state listed.
4. COVERAGE CHECK (output last): a table of every step-1 item -> its counterpart -> the
   component/token used. Flag anything you could NOT carry over (should be nothing). If
   inventory and redesign don't match 1:1, fix it.

SCREEN-SPECIFIC (preserve exactly / states / rules / restyle goal):
${block}

DELIVER: light + dark, desktop + mobile, every state, with the coverage table.`;

const md = readFileSync(SRC, 'utf8');
const lines = md.split('\n');

// Collect ### blocks that live under "## 2." / "## 3." / "## 4." (skip how-to + master).
const blocks = [];
let inScreens = false, cur = null;
for (const ln of lines) {
  if (/^##\s+[234]\./.test(ln)) { inScreens = true; continue; }
  if (/^##\s+1\./.test(ln)) { inScreens = false; continue; }
  if (!inScreens) continue;
  if (ln.startsWith('### ')) { if (cur) blocks.push(cur); cur = { title: ln.slice(4).trim(), lines: [] }; continue; }
  if (cur) cur.lines.push(ln);
}
if (cur) blocks.push(cur);

const field = (b, key) => {
  const l = b.lines.find((x) => x.startsWith(`**${key}:**`));
  return l ? l.slice(`**${key}:**`.length).trim() : '';
};
const slugFrom = (b) => {
  const at = field(b, 'Attach');
  const m = at.match(/`?([a-z0-9._-]+)\.(?:png)`?/i);
  if (m) return m[1].replace(/\.(desktop|mobile)$/i, '');
  return b.title.split('—')[0].split('(')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.txt')) rmSync(`${OUT}/${f}`);

let n = 0;
const index = [];
for (const b of blocks) {
  const screen = field(b, 'SCREEN') || b.title;
  const attach = field(b, 'Attach') || '(no screenshot — see note)';
  // screen-specific body = every ** line except Attach/SCREEN
  const body = b.lines
    .filter((x) => x.startsWith('**') && !x.startsWith('**Attach:**') && !x.startsWith('**SCREEN:**'))
    .join('\n');
  const shot = attach.replace(/`/g, '');
  const isFile = /\.png/i.test(shot);
  const header = isFile
    ? `# ${b.title}\n# ATTACH THIS IMAGE: docs/redesign-screens/${shot.match(/([a-z0-9._-]+\.png)/i)?.[1] ?? shot}\n# (drag it into Claude Design; set Design system = Lyra Component Library; then paste everything below)`
    : `# ${b.title}\n# SCREENSHOT: ${shot}\n# (capture it, then drag into Claude Design; Design system = Lyra Component Library; paste everything below)`;
  const slug = slugFrom(b) || `screen-${n}`;
  writeFileSync(`${OUT}/${String(n).padStart(2, '0')}-${slug}.txt`, `${header}\n\n${MASTER(screen, body)}\n`);
  index.push(`${String(n).padStart(2, '0')}-${slug}.txt  <-  ${isFile ? shot.match(/([a-z0-9._-]+\.png)/i)?.[1] : 'manual'}`);
  n++;
}
writeFileSync(`${OUT}/_INDEX.txt`, `Lyra redesign prompts — ${n} screens.\nOpen a .txt, copy all, paste into Claude Design, attach the named screenshot.\n\n${index.join('\n')}\n`);
console.log(`wrote ${n} per-screen prompt files -> ${OUT}/`);
