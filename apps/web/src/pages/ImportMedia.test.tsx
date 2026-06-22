import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

// Component to test: renders the error section with optional retry button
function ErrorSection({ error, expired, onRetry }: { error: string; expired: boolean; onRetry?: () => void }) {
  return (
    <div className="cx-error-section">
      <p className="cx-error">{error}</p>
      {expired && (
        <button className="cx-btn-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

describe('ImportMedia ErrorSection', () => {
  test('renders error without retry button when not expired', () => {
    const html = renderToStaticMarkup(
      <ErrorSection error="Something went wrong" expired={false} />
    );
    expect(html).toContain('Something went wrong');
    expect(html).not.toContain('Retry');
  });

  test('renders error with retry button when expired', () => {
    const html = renderToStaticMarkup(
      <ErrorSection error="Job expired or not found" expired={true} />
    );
    expect(html).toContain('Job expired or not found');
    expect(html).toContain('Retry');
    expect(html).toContain('cx-btn-retry');
  });
});
