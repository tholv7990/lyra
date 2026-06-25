import { describe, expect, it } from 'vitest';
import { toggleInList } from './array';

describe('toggleInList', () => {
  it('adds a value when not present', () => {
    expect(toggleInList<string>([], 'a')).toEqual(['a']);
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('removes a value when already present', () => {
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleInList(['a'], 'a')).toEqual([]);
  });
  it('round-trips (toggle twice = original membership)', () => {
    const once = toggleInList(['x'], 'y');
    expect(toggleInList(once, 'y')).toEqual(['x']);
  });
});
