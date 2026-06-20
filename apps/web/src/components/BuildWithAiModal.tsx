import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AiChatResponse, AiChatTurn, GeneratedPipeline, PipelineStepInput } from '@lyra/shared';
import { api } from '../lib/api';

interface Props {
  wsId: string;
  onClose: () => void;
  // Revise mode ("Edit with AI"): the current steps the AI starts from. With
  // onApply, an applied draft updates the open builder instead of starting new.
  current?: PipelineStepInput[];
  onApply?: (draft: GeneratedPipeline) => void;
}

// Conversational pipeline builder: a short back-and-forth where the AI asks
// clarifying questions and/or proposes a pipeline (grounded to the prompt
// library). When a proposal looks right, "Apply" drops it into the builder.
export function BuildWithAiModal({ wsId, onClose, current, onApply }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editMode = !!onApply;
  const [messages, setMessages] = useState<AiChatTurn[]>([]);
  const [draft, setDraft] = useState<GeneratedPipeline | null>(null);
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
      // Send the latest proposed steps as `current` so the AI sees the live state.
      const ctx: PipelineStepInput[] | undefined = draft
        ? draft.steps.map((s) => ({
            name: s.name,
            promptId: s.promptId ?? '',
            provider: s.provider,
            model: s.model,
            mode: s.mode,
          }))
        : current;
      const res = await api<AiChatResponse>(`/workspaces/${wsId}/pipelines/ai-chat`, {
        method: 'POST',
        body: JSON.stringify({ messages: next, ...(ctx ? { current: ctx } : {}) }),
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
      if (res.draft) setDraft(res.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pipelines.generateError'));
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!draft) return;
    if (onApply) {
      onApply(draft);
      onClose();
    } else {
      navigate('/pipelines/new', { state: { draft } });
      onClose();
    }
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog bwa bwa-chat" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="bwa-head">
          <h3>✨ {t(editMode ? 'pipelines.editWithAiTitle' : 'pipelines.buildWithAiTitle')}</h3>
          <button type="button" className="srm-x" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className="bwa-msgs" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="bwa-empty">{t(editMode ? 'pipelines.editWithAiHint' : 'pipelines.buildWithAiHint')}</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bwa-msg ${m.role}`}>
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

        {draft && (
          <div className="bwa-draft">
            <span className="bwa-draft-info">
              ✨ <strong>{draft.name}</strong> · {t('pipelines.steps', { count: draft.steps.length })}
            </span>
            <button type="button" className="btn-primary btn-inline" onClick={apply}>
              {t('pipelines.applyToBuilder')}
            </button>
          </div>
        )}

        <div className="bwa-compose">
          <textarea
            className="text-input bwa-input"
            rows={2}
            autoFocus
            placeholder={t('pipelines.askPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
            }}
          />
          <button
            type="button"
            className="btn-primary bwa-send btn-inline"
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
