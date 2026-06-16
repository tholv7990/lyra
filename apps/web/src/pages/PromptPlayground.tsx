import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
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
  const [showHistory, setShowHistory] = useState(false);

  const [provider, setProvider] = useState<Provider>(Provider.Anthropic);
  const [model, setModel] = useState<string>(defaultModel(Provider.Anthropic));
  const [input, setInput] = useState('');
  const [view, setView] = useState<View | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [modelMenu, setModelMenu] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // close the model picker on outside click
  useEffect(() => {
    if (!modelMenu) return;
    const onDown = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [modelMenu]);

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

  // Autoscroll while streaming.
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [view?.result, streaming]);

  const visibleHistory = useMemo(
    () => (starredOnly ? history.filter((t) => t.starred) : history),
    [history, starredOnly],
  );

  const send = useCallback(
    async (text: string) => {
      if (!wsId || !id || !text.trim() || streaming) return;
      setError(null);
      setView({ input: text, result: '' });
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        await streamSSE(
          `/workspaces/${wsId}/prompts/${id}/tests`,
          { provider, model, input: text },
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
                input: text,
                result: v?.result ?? '',
                error: String(evt.message ?? 'Test failed'),
                test,
              }));
              if (test) setHistory((h) => [test, ...h]);
            }
          },
          ctrl.signal,
        );
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          setView((v) => ({ input: text, result: v?.result ?? '', error: e instanceof Error ? e.message : 'Test failed' }));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [wsId, id, streaming, provider, model],
  );

  function stop() {
    abortRef.current?.abort();
  }

  function newTest() {
    if (streaming) abortRef.current?.abort();
    setView(null);
    setInput(prompt?.content ?? '');
    setError(null);
    setShowHistory(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send(input);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
    <div className={`chat ${showHistory ? 'history-open' : ''}`}>
      {showHistory && <div className="chat-scrim" onClick={() => setShowHistory(false)} />}

      <aside className="chat-history">
        <div className="chat-history-head">
          <button className="btn-ghost chat-new" onClick={newTest}>+ New test</button>
          <button
            className={`pg-filter ${starredOnly ? 'on' : ''}`}
            onClick={() => setStarredOnly((s) => !s)}
            title="Starred only"
          >
            ★
          </button>
        </div>
        <div className="chat-history-list">
          {visibleHistory.length === 0 ? (
            <p className="pg-empty">No tests yet.</p>
          ) : (
            visibleHistory.map((t) => (
              <button
                key={t.id}
                className={`pg-hist-item ${view?.test?.id === t.id ? 'active' : ''}`}
                onClick={() => { setView({ input: t.input, result: t.result, error: t.error, test: t }); setShowHistory(false); }}
              >
                <div className="pg-hist-top">
                  <span className="badge">{modelLabel(t.provider, t.model)}</span>
                  {t.starred && <span className="pg-star">★</span>}
                </div>
                <div className="pg-hist-snip">{t.error ? `⚠ ${t.error}` : t.result}</div>
                {t.tags.length > 0 && (
                  <div className="pg-hist-tags">
                    {t.tags.map((tag) => (
                      <span key={tag} className="tag-chip ro" style={{ color: tagColor(tag), borderColor: `${tagColor(tag)}55`, background: `${tagColor(tag)}14` } as CSSProperties}>
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

      <main className="chat-main">
        <header className="chat-top">
          <Link to="/prompts" className="pg-back">← Prompts</Link>
          <h2>{prompt ? prompt.title : 'Test'}</h2>
          <div className="chat-top-actions">
            <button className="btn-ghost chat-new-inline" onClick={newTest}>+ New</button>
            <button className="btn-ghost chat-history-toggle" onClick={() => setShowHistory((s) => !s)}>
              History
            </button>
          </div>
        </header>

        {error && <p className="error" style={{ margin: '0 16px' }}>{error}</p>}

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-thread">
            {!view ? (
              <div className="chat-empty">
                <h3>Test this prompt</h3>
                <p>Pick a model, tweak the prompt below, and send. Every run is saved to history.</p>
              </div>
            ) : (
              <>
                <div className="msg user">
                  <div className="bubble">{view.input}</div>
                </div>
                <div className="msg ai">
                  <div className="ai-meta">{PROVIDER_LABELS[provider]} · {modelLabel(provider, model)}</div>
                  <div className={`ai-text ${view.error ? 'err' : ''}`}>
                    {view.error ? view.error : view.result || (streaming ? '' : '—')}
                    {streaming && <span className="pg-caret" />}
                  </div>
                  {view.test && !streaming && (
                    <>
                      <div className="ai-actions">
                        <button className="txt-btn" onClick={() => copy(view.result)}>{copied ? 'Copied' : 'Copy'}</button>
                        <button className="txt-btn" onClick={() => void send(view.input)}>Regenerate</button>
                        <button className={`txt-btn ${view.test.starred ? 'accent' : ''}`} onClick={() => void toggleStar(view.test!)}>
                          {view.test.starred ? '★ Starred' : '☆ Star'}
                        </button>
                        <button className="txt-btn danger" onClick={() => void remove(view.test!)}>Delete</button>
                      </div>
                      <div className="ai-tags">
                        <TagInput value={view.test.tags} suggestions={[]} onChange={(tags) => void setTags(view.test!, tags)} />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="chat-composer">
          <div className="composer-box">
            <textarea
              className="composer-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Prompt to test…  (⌘/Ctrl + Enter to send)"
            />
            <div className="composer-bar">
              <div className="model-pick" ref={modelRef}>
                <button type="button" className="model-pill" onClick={() => setModelMenu((s) => !s)}>
                  <span className="mp-provider">{PROVIDER_LABELS[provider]}</span>
                  <span className="mp-model">{modelLabel(provider, model)}</span>
                  <span className="mp-caret">⌄</span>
                </button>
                {modelMenu && (
                  <div className="model-menu">
                    {PROVIDERS.map((p) => (
                      <div key={p} className="model-menu-group">
                        <div className="mmg-label">{PROVIDER_LABELS[p]}</div>
                        {(MODEL_CATALOG[p] ?? []).map((m) => {
                          const active = provider === p && model === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className={`model-menu-item ${active ? 'active' : ''}`}
                              onClick={() => { setProvider(p); setModel(m.id); setModelMenu(false); }}
                            >
                              <span>{m.label}</span>
                              {active && <span className="mm-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {streaming ? (
                <button className="send-btn stop" onClick={stop} title="Stop">■</button>
              ) : (
                <button className="send-btn" onClick={() => void send(input)} disabled={!input.trim()} title="Send">↑</button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
