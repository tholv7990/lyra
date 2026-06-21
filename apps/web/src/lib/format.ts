import type { CSSProperties } from 'react';
import { labelColor } from '@lyra/shared';

// Shared display formatters. These were copy-pasted across the library pages and
// avatar surfaces; keep them here so date/avatar rendering stays identical.

/** Locale date, day only — e.g. "Jun 19 2026". */
export function fmtDate(iso: string): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return [month, day, year].filter(Boolean).join(' ');
}

/** First letter of a name, uppercased — single-char avatar fallback. */
export function initial(name?: string, fallback = '?'): string {
  return name?.trim().charAt(0).toUpperCase() || fallback;
}

/** Up to two initials (first + last word) — used for workspace/user avatars. */
export function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Deterministic avatar tint from a name: ink color + a 16-hex-alpha wash. */
export function avatarStyle(name?: string): CSSProperties {
  const c = labelColor(name || 'User', []);
  return { color: c, background: `${c}16` };
}

/** ISO-delta as "1.4s" / "850ms", or null unless both timestamps are present and valid. */
export function fmtDuration(a?: string, b?: string): string | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
