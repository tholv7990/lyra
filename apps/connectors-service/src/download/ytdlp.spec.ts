import { typeFromExt, mapResolveJson, resolveArgs, downloadArgs, ytDlpReason } from './ytdlp';

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
