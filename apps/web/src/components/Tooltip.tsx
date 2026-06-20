import type { ReactNode } from 'react';

// Linear-style tooltip: a dark, compact bubble shown on hover/focus of its
// child. CSS-driven (no JS positioning) — fine for short labels.
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tip-wrap">
      {children}
      <span className="tip" role="tooltip">{label}</span>
    </span>
  );
}
