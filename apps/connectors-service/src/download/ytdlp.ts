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
