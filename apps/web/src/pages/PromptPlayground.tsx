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
  isAllowedMedia,
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
  MediaType,
  Provider,
  tagColor,
  type Prompt,
  type PromptMedia,
  type PromptTest,
} from '@lyra/shared';
import { api, streamSSE } from '../lib/api';
import { useModels, type ModelCatalog } from '../lib/useModels';
import { AttachmentPreviews } from '../components/AttachmentPreviews';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';

const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
};
const PROVIDERS = Object.values(Provider);

function modelLabel(catalog: ModelCatalog, provider: Provider, model: string) {
  return catalog[provider]?.find((m) => m.id === model)?.label ?? model;
}
function initials(name?: string) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
}
const Spark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l1.7 6.1a3 3 0 0 0 2.2 2.2L22 12l-6.1 1.7a3 3 0 0 0-2.2 2.2L12 22l-1.7-6.1a3 3 0 0 0-2.2-2.2L2 12l6.1-1.7a3 3 0 0 0 2.2-2.2z" />
  </svg>
);
const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconRetry = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

interface View {
  input: string;
  media?: PromptMedia[];
  result: string;
  error?: string;
  provider: Provider;
  model: string;
  test?: PromptTest;
}

export function PromptPlayground() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { catalog } = useModels(wsId);

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [history, setHistory] = useState<PromptTest[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [provider, setProvider] = useState<Provider>(Provider.Anthropic);
  const [model, setModel] = useState<string>(defaultModel(Provider.Anthropic));
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PromptMedia[]>([]);
  const [uploading, setUploading] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [modelMenu, setModelMenu] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      .then((p) => { setPrompt(p); setInput(p.content); setAttachments(p.media ?? []); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load prompt'));
    loadHistory();
  }, [id, loadHistory]);

  useEffect(() => {
    if (streaming && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [view?.result, streaming]);

  const visibleHistory = useMemo(
    () => (starredOnly ? history.filter((t) => t.starred) : history),
    [history, starredOnly],
  );

  async function uploadFiles(files: FileList | null) {
    if (!files || !wsId) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!isAllowedMedia(file.type, file.name)) { setError(`${file.name}: file type not allowed`); continue; }
      if (file.size > MEDIA_MAX_BYTES) { setError(`${file.name}: exceeds 25 MB`); continue; }
      setUploading((u) => u + 1);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const media = await api<PromptMedia>(`/workspaces/${wsId}/files`, { method: 'POST', body: fd });
        setAttachments((a) => [...a, media]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not upload ${file.name}`);
      } finally {
        setUploading((u) => u - 1);
      }
    }
  }

  const send = useCallback(
    async (text: string, media: PromptMedia[]) => {
      if (!wsId || !id || (!text.trim() && media.length === 0) || streaming) return;
      setError(null);
      setView({ input: text, media, result: '', provider, model });
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        await streamSSE(
          `/workspaces/${wsId}/prompts/${id}/tests`,
          { provider, model, input: text, media },
          (evt) => {
            if (evt.type === 'delta') {
              setView((v) => (v ? { ...v, result: v.result + String(evt.text ?? '') } : v));
            } else if (evt.type === 'done') {
              const t = evt.test as PromptTest;
              setView({ input: t.input, media: t.media, result: t.result, provider: t.provider, model: t.model, test: t });
              setHistory((h) => [t, ...h]);
            } else if (evt.type === 'error') {
              const t = evt.test as PromptTest | undefined;
              setView((v) => ({
                input: text, media, result: v?.result ?? '',
                error: String(evt.message ?? 'Test failed'),
                provider, model, test: t,
              }));
              if (t) setHistory((h) => [t, ...h]);
            }
          },
          ctrl.signal,
        );
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          setView((v) => ({ input: text, media, result: v?.result ?? '', error: e instanceof Error ? e.message : 'Test failed', provider, model }));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [wsId, id, streaming, provider, model],
  );

  function stop() { abortRef.current?.abort(); }

  function newTest() {
    if (streaming) abortRef.current?.abort();
    setView(null);
    setInput(prompt?.content ?? '');
    setAttachments(prompt?.media ?? []);
    setError(null);
    setShowHistory(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send(input, attachments);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function toggleStar(test: PromptTest) {
    try {
      const updated = await api<PromptTest>(`/prompt-tests/${test.id}`, { method: 'PATCH', body: JSON.stringify({ starred: !test.starred }) });
      setHistory((h) => h.map((t) => (t.id === updated.id ? updated : t)));
      setView((v) => (v?.test?.id === updated.id ? { ...v, test: updated } : v));
    } catch { /* ignore */ }
  }

  async function remove(test: PromptTest) {
    try {
      await api(`/prompt-tests/${test.id}`, { method: 'DELETE' });
      setHistory((h) => h.filter((t) => t.id !== test.id));
      setView((v) => (v?.test?.id === test.id ? null : v));
    } catch { /* ignore */ }
  }

  const aiProvider = view?.test?.provider ?? view?.provider ?? provider;
  const aiModel = view?.test?.model ?? view?.model ?? model;

  return (
    <div className={`chat ${showHistory ? 'history-open' : ''}`}>
      {showHistory && <div className="chat-scrim" onClick={() => setShowHistory(false)} />}

      <aside className="chat-history">
        <div className="chat-history-head">
          <button className="btn-ghost chat-new" onClick={newTest}>+ New test</button>
          <button className={`pg-filter ${starredOnly ? 'on' : ''}`} onClick={() => setStarredOnly((s) => !s)} title="Starred only">★</button>
        </div>
        <div className="chat-history-list">
          {visibleHistory.length === 0 ? (
            <p className="pg-empty">No tests yet.</p>
          ) : (
            visibleHistory.map((t) => (
              <button
                key={t.id}
                className={`pg-hist-item ${view?.test?.id === t.id ? 'active' : ''}`}
                onClick={() => { setView({ input: t.input, media: t.media, result: t.result, error: t.error, provider: t.provider, model: t.model, test: t }); setShowHistory(false); }}
              >
                <div className="pg-hist-top">
                  <span className="badge">{modelLabel(catalog, t.provider, t.model)}</span>
                  {t.starred && <span className="pg-star">★</span>}
                </div>
                <div className="pg-hist-snip">{t.error ? `⚠ ${t.error}` : t.result}</div>
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
            <button className="btn-ghost chat-history-toggle" onClick={() => setShowHistory((s) => !s)}>History</button>
          </div>
        </header>

        {error && <p className="error" style={{ margin: '0 16px' }}>{error}</p>}

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-thread">
            {!view ? (
              <div className="chat-empty">
                <h3>Test this prompt</h3>
                <p>Pick a model, attach files if needed, tweak the prompt below, and send.</p>
              </div>
            ) : (
              <>
                <div className="cmsg">
                  <div className="cavatar user">{initials(user?.name)}</div>
                  <div className="cbody">
                    {view.media && view.media.length > 0 && (
                      <div className="cmedia">
                        {view.media.map((m, i) => (
                          <Attachment key={`${m.url}-${i}`} m={m} />
                        ))}
                      </div>
                    )}
                    <div className="cbubble">{view.input}</div>
                  </div>
                </div>

                <div className="cmsg">
                  <div className="cavatar ai"><Spark /></div>
                  <div className="cbody">
                    <div className="cmodel">{PROVIDER_LABELS[aiProvider]} · {modelLabel(catalog, aiProvider, aiModel)}</div>
                    <div className={`ctext ${view.error ? 'err' : ''}`}>
                      {view.error ? view.error : view.result || (streaming ? '' : '—')}
                      {streaming && <span className="pg-caret" />}
                    </div>
                    {view.test && !streaming && (
                      <div className="cactions">
                        <button className="cicon" onClick={() => copy(view.result)} title={copied ? 'Copied' : 'Copy'}><IconCopy /></button>
                        <button className="cicon" onClick={() => void send(view.input, view.media ?? [])} title="Regenerate"><IconRetry /></button>
                        <button className={`cicon ${view.test.starred ? 'on' : ''}`} onClick={() => void toggleStar(view.test!)} title={view.test.starred ? 'Starred' : 'Star'}>{view.test.starred ? '★' : '☆'}</button>
                        <button className="cicon danger" onClick={() => void remove(view.test!)} title="Delete"><IconTrash /></button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="chat-composer">
          <div className="composer-box">
            <AttachmentPreviews
              media={attachments}
              uploading={uploading}
              onRemove={(idx) => setAttachments((a) => a.filter((_, i) => i !== idx))}
            />
            <textarea
              className="composer-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Prompt to test…  (⌘/Ctrl + Enter to send)"
            />
            <div className="composer-bar">
              <button type="button" className="composer-add" onClick={() => fileRef.current?.click()} title="Attach files">+</button>
              <input ref={fileRef} type="file" hidden multiple accept={MEDIA_ACCEPT} onChange={(e) => { void uploadFiles(e.target.files); e.target.value = ''; }} />

              <div className="model-pick" ref={modelRef}>
                <button type="button" className="model-pill" onClick={() => setModelMenu((s) => !s)}>
                  <span className="mp-provider">{PROVIDER_LABELS[provider]}</span>
                  <span className="mp-model">{modelLabel(catalog, provider, model)}</span>
                  <span className="mp-caret">⌄</span>
                </button>
                {modelMenu && (
                  <div className="model-menu">
                    {PROVIDERS.map((p) => (
                      <div key={p} className="model-menu-group">
                        <div className="mmg-label">{PROVIDER_LABELS[p]}</div>
                        {(catalog[p] ?? []).map((m) => {
                          const active = provider === p && model === m.id;
                          return (
                            <button key={m.id} type="button" className={`model-menu-item ${active ? 'active' : ''}`} onClick={() => { setProvider(p); setModel(m.id); setModelMenu(false); }}>
                              <span>{m.label}</span>{active && <span className="mm-check">✓</span>}
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
                <button className="send-btn" onClick={() => void send(input, attachments)} disabled={!input.trim() && attachments.length === 0} title="Send">↑</button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Attachment({ m }: { m: PromptMedia }) {
  if (m.type === MediaType.Image) {
    return (
      <a href={m.url} target="_blank" rel="noreferrer" className="cmedia-thumb">
        <img src={m.url} alt={m.name ?? 'image'} />
      </a>
    );
  }
  const c = tagColor(m.name ?? m.url);
  return (
    <a href={m.url} target="_blank" rel="noreferrer" className="cmedia-file" style={{ color: c, background: `${c}14`, borderColor: `${c}40` } as CSSProperties}>
      {m.name ?? 'file'}
    </a>
  );
}
