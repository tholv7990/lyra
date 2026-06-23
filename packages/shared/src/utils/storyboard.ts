import type { Storyboard, StoryboardFrame } from '../models';

const ASPECTS = ['9:16', '1:1', '16:9'] as const;
const MIN_FRAME_SEC = 1;
const DEFAULT_FRAME_SEC = 3;
const MAX_FRAMES = 50;

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// Coerce arbitrary (LLM/external) input into a schema-valid Storyboard. Pure +
// deterministic — the contract every producer's output passes through before render.
export function normalizeStoryboard(raw: unknown): Storyboard {
  const r = obj(raw);
  const aspect = (ASPECTS as readonly string[]).includes(r.aspect as string)
    ? (r.aspect as Storyboard['aspect'])
    : '9:16';

  const framesIn = Array.isArray(r.frames) ? r.frames : [];
  const frames: StoryboardFrame[] = framesIn
    .filter((f) => !!f && typeof f === 'object' && !Array.isArray(f))
    .slice(0, MAX_FRAMES)
    .map((f, i) => {
      const o = f as Record<string, unknown>;
      const dur = typeof o.durationSec === 'number' && Number.isFinite(o.durationSec) ? o.durationSec : DEFAULT_FRAME_SEC;
      const frame: StoryboardFrame = {
        index: i,
        narration: str(o.narration),
        imagePrompt: str(o.imagePrompt),
        mediaType: o.mediaType === 'video' ? 'video' : 'image',
        durationSec: Math.max(MIN_FRAME_SEC, dur),
      };
      if (typeof o.assetId === 'string') frame.assetId = o.assetId;
      if (o.templateParams && typeof o.templateParams === 'object' && !Array.isArray(o.templateParams)) {
        frame.templateParams = o.templateParams as Record<string, unknown>;
      }
      return frame;
    });

  const a = obj(r.audio);
  const audio: NonNullable<Storyboard['audio']> = {};
  if (typeof a.voiceId === 'string') audio.voiceId = a.voiceId;
  if (typeof a.bgmId === 'string') audio.bgmId = a.bgmId;
  if (typeof a.speed === 'number' && Number.isFinite(a.speed)) audio.speed = a.speed;

  const sb: Storyboard = {
    title: str(r.title),
    aspect,
    template: str(r.template) || 'ugc-9x16',
    templateParams: obj(r.templateParams),
    frames,
    totalDurationSec: frames.reduce((s, f) => s + f.durationSec, 0),
  };
  if (Object.keys(audio).length) sb.audio = audio;
  return sb;
}
