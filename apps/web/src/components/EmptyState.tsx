import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** The illustrative icon, already sized by the caller (e.g. <PromptsIcon width={26} height={26} />). */
  icon: ReactNode;
  title: string;
  body: string;
  /** Optional primary call-to-action. */
  cta?: { label: string; onClick: () => void };
}

// Shared empty-state used by every library list (Prompts / Pipelines / Projects)
// so the "nothing here yet" treatment is identical everywhere. Reuses the
// existing `.prompt-empty` styles — one component, one look.
export function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  return (
    <div className="prompt-empty">
      <div className="prompt-empty-art">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {cta && (
        <button className="btn-primary" onClick={cta.onClick}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
