import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  defaultModel,
  MODEL_CATALOG,
  Provider,
  tagColor,
  type Prompt,
  type PromptTest,
} from '@lyra/shared';
import { api, streamSSE } from '../lib/api';
import { useWorkspace } from '../workspace/useWorkspace';
import { TagInput } from '../components/TagInput';

const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
};
const PROVIDERS = Object.values(Provider);

function modelLabel(provider: Provider, model: string) {
  return MODEL_CATALOG[provider]?.find((m) => m.id === model)?.label ?? model;
}

// What the chat area is currently showing.
interface View {
  input: string;
  result: string;
  error?: string;
  test?: PromptTest;
}

export function PromptPlayground() {
  const { id } = useParams<{ id: string }>();
  const { current } = useWorkspace();
  const wsId = current?.id;

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [history, setHistory] = useState<PromptTest[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);

  const [provider, setProvider] = useState<Provider>(Provider.Anthropic);
  const [model, setModel] = useState<string>(defaultModel(Provider.Anthropic));
  const [input, setInput] = useState('');
  const [view, setView] = useState<View | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    if (!wsId || !id) return;
    api<PromptTest[]>(`/workspaces/${wsId}/prompts/${id}/tests`)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [wsId, id]);

  useEffect(() => {
    if (!id) return;
    api<Prompt>(`/prompts/${id}`)
      .then((p) => {
        setPrompt(p);
        setInput(p.content);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load prompt'));
    loadHistory();
  }, [id, loadHistory]);

  const visibleHistory = useMemo(
    () => (starredOnly ? history.filter((t) => t.starred) : history),
    [history, starredOnly],
  );

  function pickProvider(p: Provider) {
    setProvider(p);
    setModel(defaultModel(p));
  }

  async function send() {
    if (!wsId || !id || !input.trim() || streaming) return;
    setError(null);
    const sent = input;
    setView({ input: sent, result: '' });
    setStreaming(true);
    try {
      await streamSSE(
        `/workspaces/${wsId}/prompts/${id}/tests`,
        { provider, model, input: sent },
        (evt) => {
          if (evt.type === 'delta') {
            setView((v) => (v ? { ...v, result: v.result + String(evt.text ?? '') } : v));
          } else if (evt.type === 'done') {
            const test = evt.test as PromptTest;
            setView({ input: test.input, result: test.result, test });
            setHistory((h) => [test, ...h]);
          } else if (evt.type === 'error') {
            const test = evt.test as PromptTest | undefined;
            setView((v) => ({
              input: sent,
              result: v?.result ?? '',
              error: String(evt.message ?? 'Test failed'),
              test,
            }));
            if (test) setHistory((h) => [test, ...h]);
          }
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Test failed';
      setView({ input: sent, result: '', error: message });
    } finally {
      setStreaming(false);
    }
  }

  async function toggleStar(test: PromptTest) {
    try {
      const updated = await api<PromptTest>(`/prompt-tests/${test.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ starred: !test.starred }),
      });
      setHistory((h) => h.map((t) => (t.id === updated.id ? updated : t)));
      setView((v) => (v?.test?.id === updated.id ? { ...v, test: updated } : v));
    } catch {
      /* ignore */
    }
  }

  async function setTags(test: PromptTest, tags: string[]) {
    try {
      const updated = await api<PromptTest>(`/prompt-tests/${test.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags }),
      });
      setHistory((h) => h.map((t) => (t.id === updated.id ? updated : t)));
      setView((v) => (v?.test?.id === updated.id ? { ...v, test: updated } : v));
    } catch {
      /* ignore */
    }
  }

  async function remove(test: PromptTest) {
    try {
      await api(`/prompt-tests/${test.id}`, { method: 'DELETE' });
      setHistory((h) => h.filter((t) => t.id !== test.id));
      setView((v) => (v?.test?.id === test.id ? null : v));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="pg">
      <aside className="pg-history">
        <div className="pg-history-head">
          <span>History</span>
          <button
            className={`pg-filter ${starredOnly ? 'on' : ''}`}
            onClick={() => setStarredOnly((s) => !s)}
            title="Starred only"
          >
            ★
          </button>
        </div>
        <div className="pg-history-list">
          {visibleHistory.length === 0 ? (
            <p className="pg-empty">No tests yet.</p>
          ) : (
            visibleHistory.map((t) => (
              <button
                key={t.id}
                className={`pg-hist-item ${view?.test?.id === t.id ? 'active' : ''}`}
                onClick={() => setView({ input: t.input, result: t.result, error: t.error, test: t })}
              >
                <div className="pg-hist-top">
                  <span className="badge">{modelLabel(t.provider, t.model)}</span>
                  {t.starred && <span className="pg-star">★</span>}
                </div>
                <div className="pg-hist-snip">{t.error ? `⚠ ${t.error}` : t.result}</div>
                {t.tags.length > 0 && (
                  <div className="pg-hist-tags">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="tag-chip ro"
                        style={
                          {
                            color: tagColor(tag),
                            borderColor: `${tagColor(tag)}55`,
                            background: `${tagColor(tag)}14`,
                          } as CSSProperties
                        }
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="pg-main">
        <div className="pg-top">
          <Link to="/prompts" className="pg-back">← Prompts</Link>
          <h2>{prompt ? `Test · ${prompt.title}` : 'Test'}</h2>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="pg-chat">
          {!view ? (
            <p className="pg-hint">Edit the prompt below, pick a model, and send to test it.</p>
          ) : (
            <>
              <div className="pg-msg user">
                <div className="pg-bubble">{view.input}</div>
              </div>
              <div className="pg-msg assistant">
                <div className={`pg-bubble ${view.error ? 'err' : ''}`}>
                  {view.error ? view.error : view.result || (streaming ? '…' : '')}
                  {streaming && !view.error && <span className="pg-caret" />}
                </div>
              </div>
              {view.test && !streaming && (
                <div className="pg-result-actions">
                  <button
                    className={`txt-btn ${view.test.starred ? 'accent' : ''}`}
                    onClick={() => void toggleStar(view.test!)}
                  >
                    {view.test.starred ? '★ Starred' : '☆ Star'}
                  </button>
                  <button className="txt-btn danger" onClick={() => void remove(view.test!)}>
                    Delete
                  </button>
                  <div className="pg-result-tags">
                    <TagInput
                      value={view.test.tags}
                      suggestions={[]}
                      onChange={(tags) => void setTags(view.test!, tags)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pg-composer">
          <div className="pg-composer-row">
            <select
              className="text-input select-sm"
              value={provider}
              onChange={(e) => pickProvider(e.target.value as Provider)}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
            <select
              className="text-input select-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {(MODEL_CATALOG[provider] ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <textarea
            className="text-input prompt-area"
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Prompt to test…"
          />
          <div className="pg-send-row">
            <span className="pg-send-hint">Editing here doesn't change the saved prompt.</span>
            <button
              className="btn-primary"
              style={{ width: 'auto', marginTop: 0 }}
              disabled={streaming || !input.trim()}
              onClick={() => void send()}
            >
              {streaming ? 'Running…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
