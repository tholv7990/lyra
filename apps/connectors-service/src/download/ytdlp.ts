import { spawn } from 'node:child_process';
import type { MediaItem } from '@lyra/shared';

const VIDEO = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']);
const AUDIO = new Set(['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac', 'ogg']);
const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);

export function typeFromExt(ext: string): MediaItem['type'] {
  const e = (ext ?? '').toLowerCase();
  if (IMAGE.has(e)) return 'image';
  if (AUDIO.has(e)) return 'audio';
  if (VIDEO.has(e)) return 'video';
  return 'video';
}

interface YtEntry { id?: string; ext?: string; thumbnail?: string; entries?: YtEntry[]; _type?: string }

function toItem(e: YtEntry, index: number): MediaItem {
  const ext = e.ext ?? 'mp4';
  return {
    index,
    type: typeFromExt(ext),
    thumbUrl: e.thumbnail,
    filename: `${e.id ?? `item-${index}`}.${ext}`,
  };
}

export function mapResolveJson(json: YtEntry): MediaItem[] {
  if (Array.isArray(json?.entries)) return json.entries.map(toItem);
  return [toItem(json ?? {}, 0)];
}

export function resolveArgs(url: string): string[] {
  return ['-J', '--no-warnings', url];
}

export function downloadArgs(url: string, outTemplate: string, indices?: number[]): string[] {
  const args = ['-o', outTemplate, '--no-warnings'];
  if (indices?.length) args.push('--playlist-items', indices.map((i) => i + 1).join(','));
  args.push(url);
  return args;
}

// Spawn yt-dlp with an argv array (no shell). Not unit-tested (integration).
export function runYtDlp(args: string[], timeoutMs = 120_000): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const ps = spawn('yt-dlp', args, { timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (d) => (stdout += d));
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
