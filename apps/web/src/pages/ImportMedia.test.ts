import { describe, expect, test } from 'vitest';
import { fetchButtonState, defaultQualityFormat } from './ImportMedia';

describe('ImportMedia fetch button state', () => {
  test('disables fetch while workspace is missing so clicks do not silently no-op', () => {
    expect(fetchButtonState({ hasWorkspace: false, workspaceLoading: false, url: 'https://x.test/v', busy: false })).toEqual({
      disabled: true,
      labelKey: 'fetch',
      spin: false,
    });
  });

  test('shows a spinning busy state while media is being resolved', () => {
    expect(fetchButtonState({ hasWorkspace: true, workspaceLoading: false, url: 'https://x.test/v', busy: true })).toEqual({
      disabled: true,
      labelKey: 'loading',
      spin: true,
      statusKey: 'resolvingMedia',
    });
  });

  test('shows a workspace preparation status before fetch can run', () => {
    expect(fetchButtonState({ hasWorkspace: false, workspaceLoading: true, url: 'https://x.test/v', busy: false })).toEqual({
      disabled: true,
      labelKey: 'loading',
      spin: true,
      statusKey: 'preparingWorkspace',
    });
  });
});

describe('defaultQualityFormat', () => {
  const q = (label: string, height: number | undefined, format: string) => ({ label, height, format });

  test('prefers the highest rung ≤720p to keep the default download small', () => {
    const qs = [q('1080p', 1080, 'f1080'), q('720p', 720, 'f720'), q('360p', 360, 'f360'), q('audio', undefined, 'fa')];
    expect(defaultQualityFormat(qs)).toBe('f720');
  });

  test('falls back to the lowest video rung when only >720p exist', () => {
    expect(defaultQualityFormat([q('2160p', 2160, 'f4k'), q('1080p', 1080, 'f1080')])).toBe('f1080');
  });

  test('returns undefined when there are no qualities', () => {
    expect(defaultQualityFormat(undefined)).toBeUndefined();
    expect(defaultQualityFormat([])).toBeUndefined();
  });
});
