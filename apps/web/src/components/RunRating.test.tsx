import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunRating, nextRating } from './RunRating';

describe('nextRating', () => {
  it('sets the clicked value when none or the other is active', () => {
    expect(nextRating(undefined, 'up')).toBe('up');
    expect(nextRating('up', 'down')).toBe('down');
  });
  it('clears when clicking the already-active value', () => {
    expect(nextRating('up', 'up')).toBeNull();
    expect(nextRating('down', 'down')).toBeNull();
  });
});

describe('RunRating', () => {
  it('renders both thumbs and marks the active one', () => {
    const html = renderToStaticMarkup(
      <RunRating value={{ value: 'up', by: 'u', at: '' }} onRate={() => {}} />,
    );
    expect((html.match(/run-rating-btn/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-pressed="true"');
  });
});
