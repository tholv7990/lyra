import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PromptStatus, labelColor, type LabelInfo, type Prompt, type SavedResult } from '@lyra/shared';
import { fmtDate, initial } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { deleteResult } from '../lib/promptResults';
import { PromptCodeBlock } from './PromptCodeBlock';
import { SavedResults } from './SavedResults';
import { ProviderIcon } from './ProviderIcon';
import { XIcon } from '../layout/icons';

// {word} placeholders in the body, de-duped (skips {step:Name} refs).
function promptVars(content: string): string[] {
  const seen = new Set<string>();
  for (const m of content.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) seen.add(m[1]);
  return [...seen];
}

// Read-only full view of a library prompt (opened by the eye icon on a row/step
// or a picker card), laid out like the marketplace detail: title · creator/date/
// status/type meta · colored labels · variable chips · the prompt in a code-block
// (copy + open-in-chat) · the run history below. Editing happens in the editor.
export function PromptDetails({
  prompt,
  labels,
  onOpenInChat,
  onClose,
}: {
  prompt: Prompt;
  labels: LabelInfo[];
  onOpenInChat?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPublic = prompt.status === PromptStatus.Public;
  const vars = promptVars(prompt.content);

  // Local copy so deleting a result updates the list without a re-fetch.
  const [results, setResults] = useState<SavedResult[]>(prompt.results);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Re-sync the local copy when a different prompt is shown.
  useEffect(() => { setResults(prompt.results); }, [prompt.id]);

  const canDelete = (r: SavedResult) =>
    !!user && (r.createdBy.id === user.id || prompt.createdBy.id === user.id);

  async function onDeleteResult(id: string) {
    setDeletingId(id);
    try {
      const updated = await deleteResult(prompt.id, id);
      setResults(updated.results);
    } catch {
      // leave the list as-is on failure
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog prompt-details pd-with-history" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
          <span>{prompt.createdBy.name}</span>
          <span className="pd-dot">·</span>
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
          <span className={`badge pd-status ${isPublic ? 'st-public' : 'st-draft'}`}>
            {isPublic ? t('prompts.statusPublic') : t('prompts.statusDraft')}
          </span>
          <span className="badge mkt-type">{t(`prompts.type.${prompt.type ?? 'text'}`)}</span>
        </div>

        <div className="pd-scroll">
        {prompt.tags.length > 0 && (
          <div className="mkt-details-tags">
            {prompt.tags.map((tag) => {
              const c = labelColor(tag, labels);
              return (
                <span key={tag} className="mkt-tag" style={{ background: `${c}1f`, borderColor: `${c}3a` }}>
                  <span className="mkt-tag-dot" style={{ background: c }} />
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {vars.length > 0 && (
          <div className="pd-tags">
            {vars.map((v) => (
              <span key={v} className="tag-chip ro mkt-var">{`{${v}}`}</span>
            ))}
          </div>
        )}

        {prompt.content.trim() ? (
          <PromptCodeBlock
            content={prompt.content}
            label={t('common.prompt')}
            onRun={onOpenInChat}
            runLabel={t('prompts.openInChat')}
          />
        ) : (
          <div className="pd-body">
            <p className="muted">{t('prompts.noContent')}</p>
          </div>
        )}

        <SavedResults
          results={results}
          onOpenChat={(cid) => { onClose(); navigate(`/chats/${cid}`); }}
          onDelete={onDeleteResult}
          canDelete={canDelete}
          deletingId={deletingId}
        />
        </div>
      </div>
    </div>
  );
}
