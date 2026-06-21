import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiChatTurn, CopilotResponse, PendingCopilotAction, Run } from '@lyra/shared';
import { api } from '../lib/api';
import { Modal } from './Modal';

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
  const [pending, setPending] = useState<PendingCopilotAction[]>([]);
  const [actBusy, setActBusy] = useState(false);
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
    setPending([]);
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
      if (res.actions?.length) setPending(res.actions);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('copilot.error'));
    } finally {
      setBusy(false);
    }
  }

  // Approve a proposed run — execute it via the normal run endpoints (this is the
  // gate: nothing runs until the user clicks). Append a result summary to the chat.
  async function approveRun(action: PendingCopilotAction) {
    if (actBusy) return;
    setActBusy(true);
    setError(null);
    try {
      const run = await api<Run>(`/projects/${action.projectId}/pipelines/${action.pipelineId}/runs`, {
        method: 'POST',
        body: JSON.stringify({ variables: {}, collections: {} }),
      });
      const done = await api<Run>(`/runs/${run.id}/run-all`, { method: 'POST' });
      const steps = (done.steps ?? []).map((s) => `${s.name} (${s.status})`).join(', ');
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `✓ ${action.pipelineName} → ${done.status}\n${steps}` },
      ]);
      setPending([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('copilot.error'));
    } finally {
      setActBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="bwa bwa-chat">
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

        {pending.map((a, i) => (
          <div className="bwa-draft copilot-action" key={i}>
            <span className="bwa-draft-info">
              ▶ {t('copilot.runProposal', { pipeline: a.pipelineName, project: a.projectName })}
            </span>
            <span className="copilot-action-btns">
              <button
                type="button"
                className="btn-ghost btn-inline"
                disabled={actBusy}
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
              >
                {t('copilot.dismiss')}
              </button>
              <button
                type="button"
                className="btn-primary btn-inline"
                disabled={actBusy}
                onClick={() => void approveRun(a)}
              >
                {actBusy ? t('copilot.running') : t('copilot.approveRun')}
              </button>
            </span>
          </div>
        ))}

        <div className="bwa-compose">
          <textarea
            className="bwa-input"
            rows={2}
            placeholder={t('copilot.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
            }}
          />
          <button
            type="button"
            className="send-btn"
            disabled={busy || !input.trim()}
            onClick={() => void send()}
            title={t('pipelines.send')}
            aria-label={t('pipelines.send')}
          >
            ↑
          </button>
        </div>
    </Modal>
  );
}
