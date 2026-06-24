import { EmptyState } from '@lyra/web';

const Art = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 18v2M16 18v2" />
  </svg>
);

export function Default() {
  return (
    <EmptyState
      icon={Art}
      title="No prompts yet"
      body="Create your first prompt or adopt one from the marketplace to get started."
      cta={{ label: 'New prompt', onClick: () => {} }}
    />
  );
}
