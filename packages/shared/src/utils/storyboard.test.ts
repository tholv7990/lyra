import { describe, it, expect } from 'vitest';
import { normalizeStoryboard } from './storyboard';

describe('normalizeStoryboard', () => {
  it('round-trips a well-formed storyboard, re-indexing frames + summing duration', () => {
    const sb = normalizeStoryboard({
      title: 'Demo', aspect: '1:1', template: 't', templateParams: { a: 1 },
      frames: [
        { index: 9, narration: 'a', imagePrompt: 'p1', mediaType: 'video', durationSec: 4, assetId: 'x' },
        { index: 3, narration: 'b', imagePrompt: 'p2', mediaType: 'image', durationSec: 2 },
      ],
    });
    expect(sb.frames.map((f) => f.index)).toEqual([0, 1]);
    expect(sb.frames[0].mediaType).toBe('video');
    expect(sb.frames[0].assetId).toBe('x');
    expect(sb.totalDurationSec).toBe(6);
    expect(sb.aspect).toBe('1:1');
  });
  it('coerces bad enums to defaults', () => {
    const sb = normalizeStoryboard({ aspect: '4:3', frames: [{ mediaType: 'gif' }] });
    expect(sb.aspect).toBe('9:16');
    expect(sb.frames[0].mediaType).toBe('image');
    expect(sb.template).toBe('ugc-9x16');
  });
  it('floors duration to 1 and defaults missing to 3', () => {
    const sb = normalizeStoryboard({ frames: [{ durationSec: -5 }, { durationSec: 0 }, {}] });
    expect(sb.frames.map((f) => f.durationSec)).toEqual([1, 1, 3]);
  });
  it('non-object raw / non-array frames → empty storyboard with defaults', () => {
    expect(normalizeStoryboard(null).frames).toEqual([]);
    expect(normalizeStoryboard({ frames: 'nope' }).frames).toEqual([]);
    expect(normalizeStoryboard(undefined).aspect).toBe('9:16');
  });
  it('caps frames at 50', () => {
    const sb = normalizeStoryboard({ frames: Array.from({ length: 60 }, () => ({})) });
    expect(sb.frames.length).toBe(50);
  });
});
