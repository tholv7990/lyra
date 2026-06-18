import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelColor, type LabelInfo, type Prompt } from '@lyra/shared';
import { Markdown } from './Markdown';
import { ProviderIcon } from './ProviderIcon';
import { CheckIcon, XIcon } from '../layout/icons';

function initial(name?: string) {
  const n = (name ?? '').trim();
  return n ? n[0].toUpperCase() : '?';
}

function fmtDate(iso: string) {
  const parts = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return [month, day, year].filter(Boolean).join(' ');
}

// Read-only full view of a library prompt (opened by the eye icon on a step or a
// picker card): title · creator · model · tags · the full content (markdown).
export function PromptDetails({
  prompt,
  labels,
  canEdit = false,
  onSaveContent,
  onClose,
}: {
  prompt: Prompt;
  labels: LabelInfo[];
  canEdit?: boolean;
  onSaveContent?: (content: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState(prompt.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChanges = content !== prompt.content;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveContent() {
    if (!canEdit || !onSaveContent || busy || !content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSaveContent(content);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('prompts.errSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog prompt-details" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pd-head">
          <h3>{prompt.title}</h3>
          <button className="pd-close" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <XIcon />
          </button>
        </div>
        <div className="pd-meta">
          <span
            className="pd-avatar"
            style={{
              color: labelColor(prompt.createdBy.name, []),
              background: `${labelColor(prompt.createdBy.name, [])}16`,
            }}
            title={t('prompts.createdBy', { name: prompt.createdBy.name })}
          >
            {initial(prompt.createdBy.name)}
          </span>
          <span>{fmtDate(prompt.createdAt)}</span>
          {prompt.provider && prompt.model && (
            <>
              <span className="pd-dot">·</span>
              <span className="pd-provider">
                <ProviderIcon provider={prompt.provider} size={14} />
                {prompt.model}
              </span>
            </>
          )}
        </div>
        {error && <p className="error">{error}</p>}
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
        {canEdit ? (
          <label className="field pd-edit">
            <span className="pd-edit-label">
              <span>{t('prompts.editPrompt')}</span>
              <button
                type="button"
                className="pd-save-icon"
                onClick={() => void saveContent()}
                aria-label="Save changes"
                title="Save changes"
                disabled={busy || !content.trim() || !hasChanges}
              >
                <CheckIcon width={16} height={16} />
              </button>
            </span>
            <textarea
              className="text-input pd-editarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
        ) : (
          <div className="pd-body">
            {prompt.content.trim() ? <Markdown>{prompt.content}</Markdown> : <p className="muted">{t('prompts.noContent')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
