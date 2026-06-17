import { useEffect } from 'react';
import { labelColor, type LabelInfo, type Prompt } from '@lyra/shared';
import { Markdown } from './Markdown';
import { XIcon } from '../layout/icons';

function initial(name?: string) {
  const n = (name ?? '').trim();
  return n ? n[0].toUpperCase() : '?';
}

// Read-only full view of a library prompt (opened by the eye icon on a step or a
// picker card): title · creator · model · tags · the full content (markdown).
export function PromptDetails({
  prompt,
  labels,
  onClose,
}: {
  prompt: Prompt;
  labels: LabelInfo[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog prompt-details" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pd-head">
          <h3>{prompt.title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close">
            <XIcon />
          </button>
        </div>
        <div className="pd-meta">
          <span className="pd-avatar">{initial(prompt.createdBy.name)}</span>
          <span>{prompt.createdBy.name}</span>
          {prompt.model && (
            <>
              <span className="pd-dot">·</span>
              <span>{prompt.model}</span>
            </>
          )}
        </div>
        {prompt.tags.length > 0 && (
          <div className="pd-tags">
            {prompt.tags.map((t) => (
              <span key={t} className="tag-chip ro">
                <span className="tdot" style={{ background: labelColor(t, labels) }} />
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="pd-body">
          {prompt.content.trim() ? <Markdown>{prompt.content}</Markdown> : <p className="muted">No content.</p>}
        </div>
      </div>
    </div>
  );
}
