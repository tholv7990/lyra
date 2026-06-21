import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PromptStatus, labelColor, type LabelInfo, type Prompt, type SavedResult } from '@lyra/shared';
import { fmtDate, initials } from '../lib/format';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';
import { useEscapeKey } from '../lib/useEscapeKey';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { deleteResult } from '../lib/promptResults';
import { promptSegments } from '../lib/promptSegments';
import { SavedResults } from './SavedResults';
import { IconButton } from './IconButton';
import { CheckIcon, ChatsIcon, CopyIcon, PencilIcon, TrashIcon, XIcon } from '../layout/icons';
import '../pages/marketplace.css';

// {word} placeholders in the body, de-duped (skips {step:Name} refs).
function promptVars(content: string): string[] {
  const seen = new Set<string>();
  for (const m of content.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) seen.add(m[1]);
  return [...seen];
}

// Read-only full view of a library prompt (modal): title + edit/delete/close ·
// creator/date/status/type meta · labels · variable chips · the prompt with
// highlighted variables (copy + open-in-chat) · the saved-results history.
// Editing happens in the editor (onEdit); edit/delete are shown only when passed.
export function PromptDetails({
  prompt,
  labels,
  onOpenInChat,
  onEdit,
  onDelete,
  onClose,
}: {
  prompt: Prompt;
  labels: LabelInfo[];
  onOpenInChat?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
  const { copied, copy } = useCopyToClipboard();
  // Seed from the list snapshot, then refetch the prompt so answers saved in chat
  // (which append to results[] elsewhere) show up even if the list item is stale.
  useEffect(() => {
    setResults(prompt.results);
    let cancelled = false;
    api<Prompt>(`/prompts/${prompt.id}`)
      .then((fresh) => { if (!cancelled) setResults(fresh.results); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [prompt.id]);

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

  useEscapeKey(onClose);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="mkd-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mkd-head pd-head2">
          <h2 className="mkd-title">{prompt.title}</h2>
          <div className="pd-head-actions">
            {onEdit && (
              <IconButton boxed icon={<PencilIcon width={16} height={16} />} label={t('prompts.edit')} onClick={onEdit} />
            )}
            {onDelete && (
              <IconButton
                boxed
                variant="danger"
                icon={<TrashIcon width={16} height={16} />}
                label={t('common.delete')}
                onClick={onDelete}
              />
            )}
            <button className="mkd-close" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
              <XIcon />
            </button>
          </div>
        </div>

        <div className="mkd-body">
          <div className="pd-meta2">
            <span
              className="pd-meta-avatar"
              style={{ background: labelColor(prompt.createdBy.name, []), color: 'var(--on-accent)' }}
              aria-hidden
            >
              {initials(prompt.createdBy.name)}
            </span>
            <span className="pd-meta-by">
              {prompt.createdBy.name} · {fmtDate(prompt.createdAt)}
            </span>
            <span className={`badge status-${prompt.status}`}>
              {isPublic ? t('prompts.statusPublic') : t('prompts.statusDraft')}
            </span>
            <span className="mkt-type-pill">{t(`prompts.type.${prompt.type ?? 'text'}`)}</span>
          </div>

          {prompt.tags.length > 0 && (
            <div className="pd-chips">
              {prompt.tags.map((tag) => (
                <span key={tag} className="mkt-chip">
                  <span className="mkt-dot" style={{ background: labelColor(tag, labels) }} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {vars.length > 0 && (
            <div className="mkd-vars pd-vars">
              {vars.map((v) => (
                <span key={v} className="mkd-var">{`{${v}}`}</span>
              ))}
            </div>
          )}

          {prompt.content.trim() ? (
            <>
              <div className="mkd-prompt-head">
                <span className="mkd-label">{t('common.prompt')}</span>
                <div className="mkd-prompt-actions">
                  <button type="button" className="mkd-btn" onClick={() => copy(prompt.content)}>
                    {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                  {onOpenInChat && (
                    <button type="button" className="mkd-btn" onClick={onOpenInChat}>
                      <ChatsIcon width={14} height={14} />
                      {t('prompts.openInChat')}
                    </button>
                  )}
                </div>
              </div>
              <div className="mkd-code pd-code">{promptSegments(prompt.content)}</div>
            </>
          ) : (
            <p className="muted">{t('prompts.noContent')}</p>
          )}

          {/* Saved-results history (per the design's "Saved results · N" section). */}
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
