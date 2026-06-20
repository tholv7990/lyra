import { spawn } from 'node:child_process';
import type { MediaItem, MediaQuality } from '@lyra/shared';

const VIDEO = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']);
const AUDIO = new Set(['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac', 'ogg']);
const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);

// Standard rungs we surface as quality options (only those actually present).
const QUALITY_LADDER = [2160, 1440, 1080, 720, 480, 360, 240];

export function typeFromExt(ext: string): MediaItem['type'] {
  const e = (ext ?? '').toLowerCase();
  if (IMAGE.has(e)) return 'image';
  if (AUDIO.has(e)) return 'audio';
  if (VIDEO.has(e)) return 'video';
  return 'video';
}

interface YtFormat { vcodec?: string; acodec?: string; height?: number; filesize?: number; filesize_approx?: number }
interface YtEntry { id?: string; ext?: string; thumbnail?: string; entries?: YtEntry[]; _type?: string; formats?: YtFormat[] }

const fmtBytes = (f: YtFormat): number | undefined => f.filesize ?? f.filesize_approx;
const hasVideo = (f: YtFormat) => !!f.vcodec && f.vcodec !== 'none';
const hasAudio = (f: YtFormat) => !!f.acodec && f.acodec !== 'none';

// Derive a short, honest quality menu from yt-dlp's format list: the standard
// video heights actually present (each a height-capped -f selector yt-dlp
// resolves with fallback), plus an audio-only option when audio exists. Returns
// undefined for images/playlists (no per-height formats) so the UI hides the picker.
export function qualitiesFromFormats(formats: YtFormat[] | undefined): MediaQuality[] | undefined {
  if (!Array.isArray(formats) || formats.length === 0) return undefined;
  const vids = formats.filter((f) => hasVideo(f) && f.height);
  const present = new Set(vids.map((f) => f.height!));
  const quals: MediaQuality[] = QUALITY_LADDER.filter((h) => present.has(h)).map((h) => {
    const sizes = vids.filter((f) => f.height === h).map(fmtBytes).filter((n): n is number => !!n);
    return {
      label: `${h}p`,
      format: `bv*[height<=${h}]+ba/b[height<=${h}]`,
      height: h,
      ...(sizes.length ? { approxBytes: Math.max(...sizes) } : {}),
    };
  });
  const audio = formats.filter((f) => hasAudio(f) && !hasVideo(f));
  if (audio.length) {
    const sizes = audio.map(fmtBytes).filter((n): n is number => !!n);
    quals.push({ label: 'audio', format: 'ba/b', ...(sizes.length ? { approxBytes: Math.max(...sizes) } : {}) });
  }
  return quals.length ? quals : undefined;
}

function toItem(e: YtEntry, index: number): MediaItem {
  const ext = e.ext ?? 'mp4';
  const qualities = qualitiesFromFormats(e.formats);
  return {
    index,
    type: typeFromExt(ext),
    thumbUrl: e.thumbnail,
    filename: `${e.id ?? `item-${index}`}.${ext}`,
    ...(qualities ? { qualities } : {}),
  };
}

export function mapResolveJson(json: YtEntry): MediaItem[] {
  if (Array.isArray(json?.entries)) return json.entries.map(toItem);
  return [toItem(json ?? {}, 0)];
}

export function resolveArgs(url: string, cookiePath?: string): string[] {
  return ['-J', '--no-warnings', ...(cookiePath ? ['--cookies', cookiePath] : []), url];
}

export function downloadArgs(
  url: string,
  outTemplate: string,
  indices?: number[],
  format?: string,
  cookiePath?: string,
): string[] {
  // --newline puts each progress update on its own line so runYtDlp can parse it.
  const args = ['-o', outTemplate, '--no-warnings', '--newline'];
  if (format) args.push('-f', format);
  if (cookiePath) args.push('--cookies', cookiePath);
  if (indices?.length) args.push('--playlist-items', indices.map((i) => i + 1).join(','));
  args.push(url);
  return args;
}

// Pull the download percentages out of a yt-dlp output chunk (e.g.
// "[download]  42.3% of 100MiB at ..."). Pure — unit-tested.
export function parsePercents(chunk: string): number[] {
  return [...chunk.matchAll(/\[download\]\s+([\d.]+)%/g)].map((m) => parseFloat(m[1]));
}

// A merged format (bv+ba) downloads two files, so raw per-file % ramps 0→100
// twice. This folds the per-file % into ONE monotonic 0–100 across all files:
// it reads the file count from "Downloading N format(s): 399+251" (the +-joined
// ids) and tracks which file is current via "[download] Destination:" lines.
// overall = (fileIdx + currentPct/100) / files. Capped at 99.9 until done (the
// merge phase emits no %). If the format line never appears, files stays 1 →
// effectively passthrough (the single-file case). Stateful — one per download.
export class ProgressTracker {
  private files = 1;
  private idx = -1; // current file index; first "Destination:" makes it 0

  // Feed a raw stdout chunk; returns the overall % if this chunk had progress.
  push(chunk: string): number | undefined {
    const fmt = chunk.match(/Downloading\s+\d+\s+format\(s\):\s*([0-9a-zA-Z+._-]+)/);
    if (fmt) this.files = fmt[1].split('+').length;
    const dests = chunk.match(/\[download\]\s+Destination:/g);
    if (dests) this.idx += dests.length;
    const pcts = parsePercents(chunk);
    if (pcts.length === 0) return undefined;
    const cur = pcts[pcts.length - 1];
    const overall = ((Math.max(this.idx, 0) + cur / 100) / this.files) * 100;
    return Math.min(99.9, Math.max(0, overall));
  }
}

// Spawn yt-dlp with an argv array (no shell). Not unit-tested (integration).
// ponytail: 10-min spawn cap covers large/long downloads (e.g. 1080p of a 1h
// video ~1GB). Sync download, no queue — move to a BullMQ job if downloads
// outgrow this or need real concurrency.
export function runYtDlp(
  args: string[],
  timeoutMs = 600_000,
  onProgress?: (pct: number) => void,
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const ps = spawn('yt-dlp', args, { timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    const tracker = onProgress ? new ProgressTracker() : null;
    ps.stdout.on('data', (d) => {
      const s = String(d);
      stdout += s;
      if (tracker) {
        const pct = tracker.push(s);
        if (pct !== undefined) onProgress!(pct);
      }
    });
    ps.stderr.on('data', (d) => (stderr += d));
    ps.on('error', reject);
    ps.on('close', (code) =>
      code === 0 ? resolve({ stdout }) : reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 500)}`)),
    );
  });
}

// Some extractors fail transiently for the SAME link — TikTok notably serves a
// page missing the rehydration blob ~half the time, and 5xx/timeouts come and go.
// Worth retrying; permanent reasons (unavailable, private, sign-in) are not.
const TRANSIENT = /rehydration|Unable to extract|Failed to (parse|extract)|HTTP Error 5\d\d|timed out|temporarily/i;
export function isTransient(reason: string): boolean {
  return TRANSIENT.test(reason);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run yt-dlp, re-invoking on transient extraction failures (with a small backoff
// so we don't hammer the site). Permanent reasons fail fast. 4 tries turns
// TikTok's ~50% per-try success into ~94%.
export async function runYtDlpRetrying(
  args: string[],
  attempts = 4,
  timeoutMs?: number,
  onProgress?: (pct: number) => void,
): Promise<{ stdout: string }> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(500);
    try {
      return await runYtDlp(args, timeoutMs, onProgress);
    } catch (err) {
      last = err;
      if (!isTransient(ytDlpReason(err))) throw err;
    }
  }
  throw last;
}

// Turn a yt-dlp failure into a short, user-facing reason. yt-dlp emits e.g.
// "ERROR: [youtube] ID: This video is not available" — strip the "yt-dlp exited N:",
// the "[extractor]" tag, and a leading "<id>:" so the line reads plainly. Falls
// back to a generic message when nothing parses.
export function ytDlpReason(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const errLine = raw.split('\n').find((l) => /ERROR:/i.test(l)) ?? raw;
  const reason = errLine
    .replace(/^.*?ERROR:\s*/i, '') // drop everything up to "ERROR:"
    .replace(/^\[[^\]]+\]\s*/, '') // drop the "[youtube]" extractor tag
    .replace(/^[\w.-]+:\s*/, '') // drop a leading "<id>:" prefix
    .trim()
    .slice(0, 300);
  return reason || 'Could not resolve media from this link.';
}
