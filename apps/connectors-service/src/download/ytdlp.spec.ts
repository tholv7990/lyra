import {
  typeFromExt,
  mapResolveJson,
  resolveArgs,
  downloadArgs,
  ytDlpReason,
  qualitiesFromFormats,
  parsePercents,
} from './ytdlp';

describe('typeFromExt', () => {
  it('classifies by extension', () => {
    expect(typeFromExt('mp4')).toBe('video');
    expect(typeFromExt('jpg')).toBe('image');
    expect(typeFromExt('m4a')).toBe('audio');
    expect(typeFromExt('weird')).toBe('video'); // default
  });
});

describe('mapResolveJson', () => {
  it('maps a single video', () => {
    const out = mapResolveJson({ id: 'abc', ext: 'mp4', thumbnail: 't.jpg' });
    expect(out).toEqual([{ index: 0, type: 'video', thumbUrl: 't.jpg', filename: 'abc.mp4' }]);
  });
  it('maps a carousel/playlist via entries', () => {
    const out = mapResolveJson({
      _type: 'playlist',
      entries: [
        { id: '1', ext: 'jpg', thumbnail: 'a.jpg' },
        { id: '2', ext: 'mp4', thumbnail: 'b.jpg' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ index: 0, type: 'image', filename: '1.jpg' });
    expect(out[1]).toMatchObject({ index: 1, type: 'video', filename: '2.mp4' });
  });
});

describe('arg builders', () => {
  it('resolveArgs ends with the url and has no shell metachars', () => {
    const a = resolveArgs('https://x/v');
    expect(a).toEqual(['-J', '--no-warnings', 'https://x/v']);
  });
  it('downloadArgs targets a template + optional playlist items', () => {
    expect(downloadArgs('https://x/v', '/tmp/%(id)s.%(ext)s')).toContain('-o');
    expect(downloadArgs('https://x/v', '/tmp/o', [0, 2])).toEqual(
      expect.arrayContaining(['--playlist-items', '1,3']),
    );
  });
  it('downloadArgs passes -f when a format is chosen, and omits it otherwise', () => {
    expect(downloadArgs('https://x/v', '/tmp/o', undefined, 'bv*[height<=720]+ba/b[height<=720]')).toEqual(
      expect.arrayContaining(['-f', 'bv*[height<=720]+ba/b[height<=720]']),
    );
    expect(downloadArgs('https://x/v', '/tmp/o')).not.toContain('-f');
  });
  it('downloadArgs requests --newline so progress is parseable', () => {
    expect(downloadArgs('https://x/v', '/tmp/o')).toContain('--newline');
  });
});

describe('parsePercents', () => {
  it('pulls every download percent from a chunk', () => {
    const chunk = '[download]   0.0% of 100MiB\n[download]  42.3% of 100MiB at 1MiB/s\n[download] 100% of 100MiB';
    expect(parsePercents(chunk)).toEqual([0, 42.3, 100]);
  });
  it('returns [] for non-progress output', () => {
    expect(parsePercents('[youtube] extracting...\n[Merger] Merging formats')).toEqual([]);
  });
});

describe('qualitiesFromFormats', () => {
  it('surfaces present ladder heights (desc) + an audio option', () => {
    const q = qualitiesFromFormats([
      { vcodec: 'avc1', height: 720, filesize: 200 },
      { vcodec: 'avc1', height: 360 },
      { vcodec: 'none', acodec: 'opus', filesize: 5 },
      { vcodec: 'av01', height: 999 }, // off-ladder → ignored
    ]);
    expect(q?.map((x) => x.label)).toEqual(['720p', '360p', 'audio']);
    expect(q?.[0]).toMatchObject({ height: 720, approxBytes: 200, format: 'bv*[height<=720]+ba/b[height<=720]' });
    expect(q?.find((x) => x.label === 'audio')).toMatchObject({ format: 'ba/b' });
  });
  it('returns undefined when there are no formats (images/playlists)', () => {
    expect(qualitiesFromFormats(undefined)).toBeUndefined();
    expect(qualitiesFromFormats([])).toBeUndefined();
  });
  it('omits audio when no audio-only format exists', () => {
    const q = qualitiesFromFormats([{ vcodec: 'avc1', acodec: 'mp4a', height: 480 }]);
    expect(q?.map((x) => x.label)).toEqual(['480p']);
  });
});

describe('ytDlpReason', () => {
  it('extracts the plain reason from a yt-dlp error', () => {
    expect(
      ytDlpReason(new Error('yt-dlp exited 1: ERROR: [youtube] ATOB4EE8SfU: This video is not available')),
    ).toBe('This video is not available');
  });
  it('strips the extractor tag + id prefix on a sign-in error', () => {
    expect(
      ytDlpReason(new Error("yt-dlp exited 1: ERROR: [youtube] ID: Sign in to confirm you're not a bot")),
    ).toBe("Sign in to confirm you're not a bot");
  });
  it('falls back to a generic line when nothing parses', () => {
    expect(ytDlpReason('')).toBe('Could not resolve media from this link.');
  });
});
