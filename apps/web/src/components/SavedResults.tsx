import { useTranslation } from 'react-i18next';
import type { SavedResult } from '@lyra/shared';
import { fmtDate } from '../lib/format';
import { ProviderIcon } from './ProviderIcon';
import { IconButton } from './IconButton';
import { ChatsIcon, XIcon } from '../layout/icons';

// Presentational list of a prompt's saved answers (the children). Used both in
// the Prompt details modal and as the rail in the chat workbench. The parent
// owns the data + api calls; this only renders and raises events.
export function SavedResults({
  results,
  onOpenChat,
  onDelete,
  canDelete,
  deletingId,
}: {
  results: SavedResult[];
  onOpenChat?: (conversationId: string) => void;
  onDelete?: (id: string) => void;
  canDelete?: (r: SavedResult) => boolean;
  deletingId?: string | null;
}) {
  const { t } = useTranslation();

  return (
    <section className="saved-results">
      <div className="sr-head">
        <span className="sr-title">{t('prompts.savedResults')}</span>
        {results.length > 0 && <span className="sr-count">{results.length}</span>}
      </div>

      {results.length === 0 ? (
        <p className="sr-empty">{t('prompts.savedResultsEmpty')}</p>
      ) : (
        <ul className="sr-list">
          {results.map((r) => (
            <li key={r.id} className="sr-item">
              <div className="sr-item-head">
                <span className="sr-meta">
                  <ProviderIcon provider={r.provider} size={13} />
                  <span className="sr-model">{r.model}</span>
                  <span className="pd-dot">·</span>
                  <span className="sr-by">{r.createdBy.name}</span>
                  <span className="pd-dot">·</span>
                  <span>{fmtDate(r.savedAt)}</span>
                </span>
                <span className="sr-actions">
                  {r.sourceConversationId && onOpenChat && (
                    <IconButton
                      size="sm"
                      icon={<ChatsIcon width={14} height={14} />}
                      label={t('prompts.openSourceChat')}
                      onClick={() => onOpenChat(r.sourceConversationId!)}
                    />
                  )}
                  {onDelete && canDelete?.(r) && (
                    <IconButton
                      size="sm"
                      variant="danger"
                      icon={<XIcon width={13} height={13} />}
                      label={t('prompts.deleteResult')}
                      disabled={deletingId === r.id}
                      onClick={() => onDelete(r.id)}
                    />
                  )}
                </span>
              </div>
              <p className="sr-output">{r.output}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
