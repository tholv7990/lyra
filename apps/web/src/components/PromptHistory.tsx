import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ConversationSummary } from '@lyra/shared';
import { api } from '../lib/api';
import { useWorkspace } from '../workspace/useWorkspace';
import { ProviderIcon } from './ProviderIcon';

function fmt(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// The prompt's run history: every chat the user started from this prompt, newest
// first, as a vertical timeline (like the pipeline run flow). Each row opens that
// conversation. Empty until the prompt has been tried in chat.
export function PromptHistory({ promptId, content }: { promptId: string; content: string }) {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const ws = current?.id;
  const [items, setItems] = useState<ConversationSummary[] | null>(null);

  useEffect(() => {
    if (!ws) return;
    let cancelled = false;
    api<ConversationSummary[]>(`/workspaces/${ws}/conversations/prompt-history-list`, {
      method: 'POST',
      body: JSON.stringify({ promptId, content }),
    })
      .then((res) => !cancelled && setItems(res))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [ws, promptId, content]);

  // Don't flash the section while loading.
  if (items === null) return null;

  return (
    <section className="pd-history">
      <div className="pd-history-head">
        <span className="pd-history-title">{t('prompts.history')}</span>
        {items.length > 0 && <span className="pd-history-count">{items.length}</span>}
      </div>

      {items.length === 0 ? (
        <p className="pd-history-empty">{t('prompts.historyEmpty')}</p>
      ) : (
        <ol className="pd-timeline">
          {items.map((c) => (
            <li key={c.id} className="pd-tl">
              <button
                type="button"
                className="pd-tl-row"
                onClick={() => navigate(`/chats/${c.id}`)}
                title={t('prompts.openThisChat')}
              >
                <span className="pd-tl-rail" aria-hidden="true">
                  <span className="pd-tl-dot" />
                </span>
                <span className="pd-tl-body">
                  <span className="pd-tl-top">
                    <span className="pd-tl-title">{c.title}</span>
                    <span className="pd-tl-date">{fmt(c.lastMessageAt ?? c.createdAt)}</span>
                  </span>
                  <span className="pd-tl-meta">
                    <ProviderIcon provider={c.provider} size={13} />
                    <span>{c.model}</span>
                    <span className="pd-dot">·</span>
                    <span>{t('prompts.historyMessages', { count: c.messageCount })}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
