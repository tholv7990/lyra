import { MediaType, Provider, Role, ProjectStatus, ProjectShare } from '../enums';
import type { StepCondition } from '../models';
import { TAG_MAX, TAG_MAX_LEN, TAG_PALETTE } from '../constants/tags';
import { MEDIA_ALLOWED_EXT, MEDIA_ALLOWED_MIME } from '../constants/media';

export interface MemberCtx {
  userId: string;
  role: Role;
  canManageKeys: boolean;
}

// Access helpers take the owner's user id (a string), not the transport Project
// — whose createdBy is a populated UserRef. Server-side passes the stored id;
// client-side passes project.createdBy.id.
export interface ProjectAccess {
  createdBy: string;
  status: ProjectStatus;
  shared: ProjectShare;
  sharedWith: string[];
}

export function canViewProject(p: ProjectAccess, ctx: MemberCtx): boolean {
  if (ctx.role === Role.Owner) return true; // owner override
  if (p.createdBy === ctx.userId) return true;
  if (p.status !== ProjectStatus.Public) return false; // draft: creator/owner only
  if (p.shared === ProjectShare.All) return true; // public to the whole workspace
  return p.sharedWith.includes(ctx.userId); // public to chosen people
}

export function canEditProject(
  p: { createdBy: string },
  ctx: MemberCtx,
): boolean {
  return ctx.role === Role.Owner || p.createdBy === ctx.userId;
}

export function canManageKeys(ctx: MemberCtx): boolean {
  return ctx.role === Role.Owner || ctx.canManageKeys;
}

// Providers that make no external AI call and therefore need no BYOK key — a
// step on one is never "locked" by a missing key. Crawl just fetches a URL.
const NO_KEY_PROVIDERS: Provider[] = [Provider.Crawl];

export function providerNeedsKey(provider: Provider): boolean {
  return !NO_KEY_PROVIDERS.includes(provider);
}

// Some providers authenticate with another provider's key. The image provider
// runs OpenAI's gpt-image-1, so image steps reuse the workspace's OpenAI key —
// no separate "image" key. Used for key resolution AND lock/gating everywhere.
const KEY_PROVIDER: Partial<Record<Provider, Provider>> = {
  [Provider.Image]: Provider.OpenAI,
};

export function keyProviderFor(provider: Provider): Provider {
  return KEY_PROVIDER[provider] ?? provider;
}

// Substitute {key} tokens with values. Each key in `vars` whose value is
// non-blank replaces every {key} occurrence; missing/blank keys leave the token
// in place. {step:Name} is never touched (its colon isn't part of a {key}). Used
// at run time over the run's variable snapshot (project + custom + system vars).
export function fillPrompt(
  tmpl: string,
  vars: Record<string, string | undefined>,
): string {
  let out = tmpl;
  for (const [key, val] of Object.entries(vars)) {
    const v = val?.trim();
    if (v) out = out.split(`{${key}}`).join(v);
  }
  return out;
}

// Evaluate a step's guard condition against the run's variables. Returns whether
// the step should RUN (true); a false result means the step is SKIPPED. String
// comparisons are case-insensitive + trimmed; gt/lt parse numbers (a non-number
// yields NaN, so the comparison is false → the step is skipped).
export function evalCondition(
  cond: StepCondition,
  vars: Record<string, string | undefined>,
): boolean {
  const left = (vars[cond.variable] ?? '').trim();
  const right = (cond.value ?? '').trim();
  const lc = left.toLowerCase();
  const rc = right.toLowerCase();
  switch (cond.op) {
    case 'exists':
      return left !== '';
    case 'empty':
      return left === '';
    case 'eq':
      return lc === rc;
    case 'ne':
      return lc !== rc;
    case 'contains':
      return right !== '' && lc.includes(rc);
    case 'gt':
      return toFiniteNumber(left) > toFiniteNumber(right);
    case 'lt':
      return toFiniteNumber(left) < toFiniteNumber(right);
    default:
      return true;
  }
}

function toFiniteNumber(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Resolve a step's run-time chaining placeholders: {input} = the previous step's
// output (the most recent earlier step that has a result), {step:Name} = a named
// earlier step's output. Returns the filled prompt and whether any placeholder
// was used (callers auto-append prior context only when none was). Lifted from
// the api so it's pure and unit-tested in one place.
export function resolveStepRefs(
  prompt: string,
  steps: { name?: string; result?: string }[],
  index: number,
): { prompt: string; used: boolean } {
  let used = false;
  let text = prompt;
  if (text.includes('{input}')) {
    used = true;
    const prev = steps.slice(0, index).reverse().find((s) => s.result);
    text = text.split('{input}').join(prev?.result ?? '');
  }
  text = text.replace(/\{step:([^}]+)\}/g, (_m, nm: string) => {
    used = true;
    const match = steps.find(
      (s) => (s.name ?? '').toLowerCase() === nm.trim().toLowerCase() && s.result,
    );
    return match?.result ?? '';
  });
  return { prompt: text, used };
}

// ===== Prompt variables (composer affordance) =====
// What a step's prompt can reference, surfaced as insertable chips in the run
// composer. Mirrors the run engine's chaining: {input} = the previous step,
// {step:Name} = any earlier named step, plus the project/context vars that are
// actually set. Pure — the web computes chips from this; no engine change.

export interface PromptVar {
  token: string;
  label: string;
  kind: 'input' | 'step' | 'project';
}

// Friendly labels for the built-in project/system var tokens (custom vars fall
// back to their key). Used to label composer chips.
export const BUILTIN_VAR_LABELS: Record<string, string> = {
  product: 'Product',
  niche: 'Niche',
  homepage: 'Homepage',
  note: 'Note',
  date: 'Date',
};

// Variables a given step can reference, surfaced as insertable composer chips:
// {input} (after the first step), any earlier named {step:Name}, and every
// run variable in `variables` that has a non-blank value (project + custom +
// system). `labels` maps a var key to its display label (else the key).
export function promptVarsForStep(
  steps: { index: number; name?: string }[],
  index: number,
  variables: Record<string, string> = {},
  labels: Record<string, string> = {},
): PromptVar[] {
  const out: PromptVar[] = [];
  if (index > 0) out.push({ token: '{input}', label: 'Previous step', kind: 'input' });
  for (const s of steps) {
    const nm = s.name?.trim();
    if (s.index < index && nm) out.push({ token: `{step:${nm}}`, label: nm, kind: 'step' });
  }
  for (const [key, val] of Object.entries(variables)) {
    if (val?.trim()) out.push({ token: `{${key}}`, label: labels[key] ?? key, kind: 'project' });
  }
  return out;
}

// {step:X} references whose name matches no step (case-insensitive), de-duped —
// lets the composer warn about dangling references before a run.
export function unknownStepRefs(prompt: string, stepNames: string[]): string[] {
  const known = new Set(
    stepNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{step:([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const nm = m[1].trim();
    const key = nm.toLowerCase();
    if (nm && !known.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(nm);
    }
  }
  return out;
}

// ===== Prompt tags =====
// Free-form tags: trimmed, internal whitespace collapsed, length-capped. The
// display casing is preserved; dedupe and lookups use the lowercased key.

export function normalizeTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_LEN).trim();
}

export function tagKey(raw: string): string {
  return normalizeTag(raw).toLowerCase();
}

// Normalize, drop blanks, dedupe case-insensitively (keeping first-seen
// casing), and cap the count. The api calls this on write so stored tags are
// always canonical; the web calls it to keep the picker in sync.
export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const value = normalizeTag(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= TAG_MAX) break;
  }
  return out;
}

// Deterministic chip color for a tag (stable across api/web). djb2 hash of the
// lowercased key into the shared palette.
export function tagColor(tag: string): string {
  const key = tagKey(tag);
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// Resolve a label's display colour: the workspace label's saved colour if one
// exists (matched case-insensitively by name), else the deterministic tagColor.
export function labelColor(
  name: string,
  labels: ReadonlyArray<{ name: string; color: string }>,
): string {
  const key = tagKey(name);
  const found = labels.find((l) => tagKey(l.name) === key);
  return found ? found.color : tagColor(name);
}

// ===== Prompt media =====
// Bucket a MIME type into one of the four media categories.
export function mediaTypeForMime(mime: string): MediaType {
  if (mime.startsWith('image/')) return MediaType.Image;
  if (mime.startsWith('audio/')) return MediaType.Audio;
  if (mime.startsWith('video/')) return MediaType.Video;
  return MediaType.File;
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

// A file is allowed if its MIME is on the list, or (for blank/odd MIMEs) its
// extension is. Used by the api to validate uploads and the web to pre-filter.
export function isAllowedMedia(mime: string, filename: string): boolean {
  if (mime && MEDIA_ALLOWED_MIME.includes(mime)) return true;
  return MEDIA_ALLOWED_EXT.includes(extOf(filename));
}
