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

export function resolveArgs(url: string): string[] {
  return ['-J', '--no-warnings', url];
}

export function downloadArgs(url: string, outTemplate: string, indices?: number[], format?: string): string[] {
  // --newline puts each progress update on its own line so runYtDlp can parse it.
  const args = ['-o', outTemplate, '--no-warnings', '--newline'];
  if (format) args.push('-f', format);
  if (indices?.length) args.push('--playlist-items', indices.map((i) => i + 1).join(','));
  args.push(url);
  return args;
}

// Pull the download percentages out of a yt-dlp output chunk (e.g.
// "[download]  42.3% of 100MiB at ..."). Pure — unit-tested.
export function parsePercents(chunk: string): number[] {
  return [...chunk.matchAll(/\[download\]\s+([\d.]+)%/g)].map((m) => parseFloat(m[1]));
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
    ps.stdout.on('data', (d) => {
      const s = String(d);
      stdout += s;
      if (onProgress) for (const pct of parsePercents(s)) onProgress(pct);
    });
    ps.stderr.on('data', (d) => (stderr += d));
    ps.on('error', reject);
    ps.on('close', (code) =>
      code === 0 ? resolve({ stdout }) : reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 500)}`)),
    );
  });
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
