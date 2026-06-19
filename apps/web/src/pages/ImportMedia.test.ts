import { describe, expect, test } from 'vitest';
import { fetchButtonState } from './ImportMedia';

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
