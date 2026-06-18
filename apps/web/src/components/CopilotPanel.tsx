import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiChatTurn, CopilotResponse } from '@lyra/shared';
import { api } from '../lib/api';

interface Props {
  wsId: string;
  onClose: () => void;
}

// Lyra Copilot (read-only): a chat where Claude uses tools to read your real
// workspace (prompts, pipelines, projects, runs) and answer grounded questions.
// Ephemeral — the conversation isn't persisted.
export function CopilotPanel({ wsId, onClose }: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AiChatTurn[]>([]);
  const [toolsByIdx, setToolsByIdx] = useState<Record<number, string[]>>({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: AiChatTurn[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await api<CopilotResponse>(`/workspaces/${wsId}/copilot`, {
        method: 'POST',
        body: JSON.stringify({ messages: next }),
      });
      if (res.tools?.length) {
        const idx = next.length; // the assistant reply lands at this index
        setToolsByIdx((m) => ({ ...m, [idx]: res.tools! }));
      }
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('copilot.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog bwa bwa-chat" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="bwa-head">
          <h3>✨ {t('copilot.title')}</h3>
          <button type="button" className="srm-x" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className="bwa-msgs" ref={scrollRef}>
          {messages.length === 0 && <p className="bwa-empty">{t('copilot.hint')}</p>}
          {messages.map((m, i) => (
            <div key={i} className={`bwa-msg ${m.role}`}>
              {toolsByIdx[i]?.length ? (
                <div className="copilot-tools">🔧 {toolsByIdx[i].join(' · ')}</div>
              ) : null}
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="bwa-msg assistant bwa-typing">
              <span /> <span /> <span />
            </div>
          )}
        </div>

        {error && <p className="error bwa-error">{error}</p>}

        <div className="bwa-compose">
          <textarea
            className="text-input bwa-input"
            rows={2}
            autoFocus
            placeholder={t('copilot.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
            }}
          />
          <button
            type="button"
            className="btn-primary bwa-send"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={busy || !input.trim()}
            onClick={() => void send()}
          >
            {t('pipelines.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
