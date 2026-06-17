import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  defaultModel,
  isAllowedMedia,
  MEDIA_MAX_BYTES,
  MediaType,
  Provider,
  tagColor,
  type Conversation,
  type ConversationMessage,
  type ConversationSummary,
  type PromptMedia,
} from '@lyra/shared';
import { api, streamSSE } from '../lib/api';
import { useModels, type ModelCatalog } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { Composer } from '../components/Composer';
import { Markdown } from '../components/Markdown';
import { ProviderIcon } from '../components/ProviderIcon';
import { SaveAsPromptModal } from '../components/SaveAsPromptModal';
import { ListIcon, PlusIcon, TrashIcon } from '../layout/icons';
import { useAppNav, useBreadcrumb } from '../layout/breadcrumb';

function modelLabel(catalog: ModelCatalog, provider: Provider, model: string) {
  return catalog[provider]?.find((m) => m.id === model)?.label ?? model;
}
function initials(name?: string) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
}

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconBookmark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
  </svg>
);

export function Chats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { labels, createLabel } = useLabels(wsId);
  const { catalog } = useModels(wsId);
  const openNav = useAppNav();

  const [list, setList] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [title, setTitle] = useState('New chat');
  useBreadcrumb(id ? title : 'Chats');

  const [provider, setProvider] = useState<Provider>(Provider.Anthropic);
  const [model, setModel] = useState<string>(defaultModel(Provider.Anthropic));
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PromptMedia[]>([]);
  const [uploading, setUploading] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveFor, setSaveFor] = useState<ConversationMessage | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const idRef = useRef(0);
  const skipLoadRef = useRef<string | null>(null);
  const seedUsedRef = useRef(false);

  const loadList = useCallback(() => {
    if (!wsId) return;
    api<ConversationSummary[]>(`/workspaces/${wsId}/conversations`)
      .then(setList)
      .catch(() => setList([]));
  }, [wsId]);

  useEffect(() => loadList(), [loadList]);

  // Load the selected conversation (skip the one we just created locally).
  useEffect(() => {
    if (!id) {
      setMessages([]);
      setTitle('New chat');
      return;
    }
    if (skipLoadRef.current === id) {
      skipLoadRef.current = null;
      return;
    }
    let cancelled = false;
    api<Conversation>(`/conversations/${id}`)
      .then((c) => {
        if (cancelled) return;
        setMessages(c.messages);
        setTitle(c.title);
        setProvider(c.provider);
        setModel(c.model);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load chat'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // "Open in chat" passes the prompt body as navigation state — prefill once.
  useEffect(() => {
    const seed = (location.state as { seed?: string } | null)?.seed;
    if (seed && !seedUsedRef.current) {
      seedUsedRef.current = true;
      setInput(seed);
    }
  }, [location.state]);

  function onThreadScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }
  useEffect(() => {
    if (streaming && atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

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

  function newChat() {
    setShowHistory(false);
    if (!id) {
      // already on a fresh canvas
      setMessages([]);
      setTitle('New chat');
      setInput('');
      setAttachments([]);
      return;
    }
    navigate('/chats');
  }

  const send = useCallback(
    async (text: string, media: PromptMedia[]) => {
      if ((!text.trim() && media.length === 0) || streaming || !wsId) return;
      setError(null);
      atBottomRef.current = true;
      const now = new Date().toISOString();
      const userMsg: ConversationMessage = {
        id: `tmp-u-${++idRef.current}`, role: 'user', content: text, media, provider, model, createdAt: now,
      };
      const aiMsg: ConversationMessage = {
        id: `tmp-a-${++idRef.current}`, role: 'assistant', content: '', provider, model, createdAt: now,
      };
      setMessages((m) => [...m, userMsg, aiMsg]);
      setInput('');
      setAttachments([]);
      setStreaming(true);

      const patchLast = (patch: Partial<ConversationMessage>) =>
        setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)));

      // Lazy-create the conversation on first send. We stream the reply while
      // still on /chats, then commit to /chats/:id AFTER it finishes — so the
      // navigation can't race the load effect and blank the thread.
      let cid = id;
      let createdNow = false;
      if (!cid) {
        try {
          const convo = await api<Conversation>(`/workspaces/${wsId}/conversations`, {
            method: 'POST',
            body: JSON.stringify({ provider, model }),
          });
          cid = convo.id;
          createdNow = true;
        } catch (e) {
          patchLast({ error: e instanceof Error ? e.message : 'Could not start chat' });
          setStreaming(false);
          return;
        }
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let streamOpened = false;
      try {
        await streamSSE(
          `/conversations/${cid}/messages`,
          { provider, model, content: text, media },
          (evt) => {
            streamOpened = true;
            if (evt.type === 'delta') {
              setMessages((m) =>
                m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + String(evt.text ?? '') } : x)),
              );
            } else if (evt.type === 'done') {
              const msg = evt.message as ConversationMessage | null;
              if (msg) patchLast(msg);
              if (evt.title) setTitle(String(evt.title));
              setStreaming(false);
              abortRef.current?.abort();
            } else if (evt.type === 'error') {
              patchLast({ error: String(evt.message ?? 'Chat failed') });
              setStreaming(false);
              abortRef.current?.abort();
            }
          },
          ctrl.signal,
        );
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          patchLast({ error: e instanceof Error ? e.message : 'Chat failed' });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        if (createdNow && !streamOpened) {
          // The send failed before anything was persisted (e.g. the chosen
          // provider has no key) — discard the empty chat so it doesn't show up
          // as a blank entry in history.
          try { await api(`/conversations/${cid}`, { method: 'DELETE' }); } catch { /* ignore */ }
        } else if (createdNow && cid) {
          // Commit the new chat to its own URL now that it has content.
          skipLoadRef.current = cid;
          navigate(`/chats/${cid}`, { replace: true });
        }
        loadList();
      }
    },
    [wsId, id, provider, model, streaming, navigate, loadList],
  );

  function stop() { abortRef.current?.abort(); }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function removeChat(c: ConversationSummary) {
    try {
      await api(`/conversations/${c.id}`, { method: 'DELETE' });
      setList((l) => l.filter((x) => x.id !== c.id));
      if (c.id === id) navigate('/chats', { replace: true });
    } catch { /* ignore */ }
  }

  return (
    <div className={`chat ${showHistory ? 'history-open' : ''}`}>
      {showHistory && <div className="chat-scrim" onClick={() => setShowHistory(false)} />}

      <aside className="chat-history">
        <button className="chat-new" onClick={newChat}>
          <PlusIcon /> New chat
        </button>
        <div className="chat-history-list">
          {list.length === 0 ? (
            <p className="pg-empty">No chats yet.</p>
          ) : (
            list.map((c) => (
              <div key={c.id} className={`cl-item ${c.id === id ? 'active' : ''}`}>
                <button
                  className="cl-open"
                  onClick={() => {
                    setShowHistory(false);
                    navigate(`/chats/${c.id}`);
                  }}
                  title={c.title}
                >
                  <span className="cl-top">
                    <ProviderIcon provider={c.provider} size={15} />
                    <span className="cl-title">{c.title}</span>
                    {c.starred && <span className="pg-star">★</span>}
                  </span>
                  <span className="cl-sub">{modelLabel(catalog, c.provider, c.model)} · {c.messageCount} msg</span>
                </button>
                <button className="cl-del" onClick={() => void removeChat(c)} title="Delete chat" aria-label="Delete chat">
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-top">
          <button className="chat-back chat-menu" onClick={openNav} aria-label="Open menu" title="Menu">
            <img src="/lyra-mark-squircle.svg" alt="Menu" width={24} height={24} />
          </button>
          <div className="pg-headinfo">
            <div className="pg-headtitle">
              <span className="pg-name">{id ? title : 'New chat'}</span>
            </div>
          </div>
          <div className="chat-top-actions">
            <button className="icon-btn" onClick={newChat} title="New chat" aria-label="New chat">
              <PlusIcon />
            </button>
            <button
              className="icon-btn chat-history-btn"
              onClick={() => setShowHistory((s) => !s)}
              title="Chats"
              aria-label="Chats"
            >
              <ListIcon />
            </button>
          </div>
        </header>

        {error && <p className="error" style={{ margin: '0 16px' }}>{error}</p>}

        <div className="chat-scroll" ref={scrollRef} onScroll={onThreadScroll}>
          <div className="chat-thread">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <h3>Start a chat</h3>
                <p>Pick a model, write a prompt, and iterate. Like a prompt? Save it to your library.</p>
              </div>
            ) : (
              messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="cmsg">
                      <div className="cavatar user">{initials(user?.name)}</div>
                      <div className="cbody">
                        <div className="cmsg-meta">
                          <ProviderIcon provider={m.provider} size={14} />
                          {modelLabel(catalog, m.provider, m.model)}
                        </div>
                        {m.media && m.media.length > 0 && (
                          <div className="cmedia">
                            {m.media.map((md, j) => <Attachment key={`${md.url}-${j}`} m={md} />)}
                          </div>
                        )}
                        <div className="cbubble">{m.content}</div>
                        <div className="cactions">
                          <button className="cmsg-save" onClick={() => setSaveFor(m)} title="Save this prompt to the library">
                            <IconBookmark /> Save as prompt
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const done = !!m.content && !m.error && !(streaming && isLast);
                return (
                  <div key={m.id} className="cmsg">
                    <div className="cavatar"><ProviderIcon provider={m.provider} size={28} /></div>
                    <div className="cbody">
                      <div className="cmsg-meta">{modelLabel(catalog, m.provider, m.model)}</div>
                      <div className={`ctext ${m.error ? 'err' : ''}`}>
                        {m.error ? m.error : m.content ? <Markdown>{m.content}</Markdown> : streaming && isLast ? '' : '—'}
                        {streaming && isLast && <span className="pg-caret" />}
                      </div>
                      {done && (
                        <div className="cactions">
                          <button className="cicon" onClick={() => copy(m.content)} title={copied ? 'Copied' : 'Copy'}><IconCopy /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="chat-composer">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => { if (!streaming) void send(input, attachments); }}
            placeholder="Message Lyra…  (⌘/Ctrl + Enter to send)"
            media={attachments}
            onRemoveMedia={(idx) => setAttachments((a) => a.filter((_, i) => i !== idx))}
            uploading={uploading}
            onFiles={(files) => void uploadFiles(files)}
            catalog={catalog}
            provider={provider}
            model={model}
            onModelChange={(p, mdl) => { setProvider(p); setModel(mdl); }}
            busy={streaming}
            onStop={stop}
            canSubmit={!!input.trim() || attachments.length > 0}
          />
        </div>
      </main>

      {saveFor && wsId && (
        <SaveAsPromptModal
          wsId={wsId}
          content={saveFor.content}
          media={saveFor.media}
          provider={saveFor.provider}
          model={saveFor.model}
          labels={labels}
          onCreateLabel={createLabel}
          onClose={() => setSaveFor(null)}
          onSaved={() => setSaveFor(null)}
        />
      )}
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
