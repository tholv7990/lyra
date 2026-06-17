import { MediaType, Role, ProjectVisibility } from '../enums';
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
  visibility: ProjectVisibility;
  sharedWith: string[];
}

export function canViewProject(p: ProjectAccess, ctx: MemberCtx): boolean {
  if (ctx.role === Role.Owner) return true; // owner override
  if (p.createdBy === ctx.userId) return true;
  if (p.visibility === ProjectVisibility.Workspace) return true;
  if (p.visibility === ProjectVisibility.Shared) {
    return p.sharedWith.includes(ctx.userId);
  }
  return false; // private, not creator
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

export function fillPrompt(
  tmpl: string,
  vars: { product?: string; niche?: string; homepage?: string; note?: string },
): string {
  return tmpl
    .replace(/{product}/g, vars.product?.trim() || '{product}')
    .replace(/{niche}/g, vars.niche?.trim() || '{niche}')
    .replace(/{homepage}/g, vars.homepage?.trim() || '{homepage}')
    .replace(/{note}/g, vars.note?.trim() || '{note}');
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
