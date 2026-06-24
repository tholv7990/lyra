import { IconButton } from '@lyra/web';

const Eye = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const X = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const Plus = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function Variants() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <IconButton icon={Eye} label="View" />
      <IconButton icon={Plus} label="Add" variant="primary" />
      <IconButton icon={X} label="Delete" variant="danger" />
      <IconButton icon={Eye} label="Boxed" boxed />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <IconButton icon={Eye} label="Small" size="sm" />
      <IconButton icon={Eye} label="Medium" size="md" />
      <IconButton icon={Eye} label="Large" size="lg" />
    </div>
  );
}
