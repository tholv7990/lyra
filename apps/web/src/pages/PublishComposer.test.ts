import { describe, expect, it } from 'vitest';
import { togglePick } from './PublishComposer';

describe('togglePick', () => {
  it('adds an id when not selected', () => {
    expect(togglePick([], 'a')).toEqual(['a']);
    expect(togglePick(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('removes an id when already selected', () => {
    expect(togglePick(['a', 'b'], 'a')).toEqual(['b']);
    expect(togglePick(['a'], 'a')).toEqual([]);
  });
  it('round-trips (toggle twice = original membership)', () => {
    const once = togglePick(['x'], 'y');
    expect(togglePick(once, 'y')).toEqual(['x']);
  });
});
