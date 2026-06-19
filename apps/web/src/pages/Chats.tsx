import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  type Prompt,
  type PromptMedia,
  type SavedResult,
} from '@lyra/shared';
import { api, streamSSE } from '../lib/api';
import { saveResult, deleteResult } from '../lib/promptResults';
import { SavedResults } from '../components/SavedResults';
import { initials } from '../lib/format';
import { useModels, type ModelCatalog } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { Composer } from '../components/Composer';
import { Markdown } from '../components/Markdown';
import { ProviderIcon } from '../components/ProviderIcon';
import { SaveAsPromptModal } from '../components/SaveAsPromptModal';
import { CopilotPanel } from '../components/CopilotPanel';
import { PlusIcon, TrashIcon, XIcon } from '../layout/icons';
import { useAppNav, useBreadcrumb } from '../layout/breadcrumb';

function modelLabel(catalog: ModelCatalog, provider: Provider, model: string) {
  return catalog[provider]?.find((m) => m.id === model)?.label ?? model;
}

// Where this chat was opened from (e.g. a library prompt). Drives the breadcrumb
// "‹ Prompts / <title>" and the in-chat back link, so there's a one-tap way back.
type ChatOrigin = { label: string; to: string; record: string };
type ChatSeedState = { seed?: string; provider?: Provider; model?: string; originPromptId?: string } | null;

export function updateMessageContent(
  messages: ConversationMessage[],
  id: string,
  content: string,
) {
  return messages.map((m) => (m.id === id ? { ...m, content } : m));
}

export function seedChatDraft(st: ChatSeedState, fallbackProvider: Provider) {
  if (!st?.seed) return null;
  const provider = st.provider ?? fallbackProvider;
  const draft: { input: string; provider: Provider; model: string; originPromptId?: string } = {
    input: st.seed,
    provider,
    model: st.model ?? defaultModel(provider),
  };
  if (st.originPromptId) draft.originPromptId = st.originPromptId;
  return draft;
}

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconBookmark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
  </svg>
);

export function Chats() {
  const { t } = useTranslation();
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
  const [title, setTitle] = useState(t('chats.newChat'));
  const [origin, setOrigin] = useState<ChatOrigin | null>(null);
  // Mirror origin in a ref so `send` can carry it through its post-stream navigate
  // without needing the latest value baked into its closure.
  const originRef = useRef<ChatOrigin | null>(null);
  useBreadcrumb(
    origin ? origin.record : id ? title : t('chats.title'),
    origin ? { label: origin.label, to: origin.to } : null,
  );

  const [provider, setProvider] = useState<Provider>(Provider.Anthropic);
  const [model, setModel] = useState<string>(defaultModel(Provider.Anthropic));
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<PromptMedia[]>([]);
  const [uploading, setUploading] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [saveFor, setSaveFor] = useState<ConversationMessage | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const idRef = useRef(0);
  const originPromptIdRef = useRef<string | null>(null);
  // The library prompt this chat is about (its parent). When set, answers can be
  // saved to it; a chat opened from a prompt is always linked to it on creation.
  const [sourcePromptId, setSourcePromptId] = useState<string | null>(null);
  const setSource = (pid: string | null) => {
    originPromptIdRef.current = pid;
    setSourcePromptId(pid);
  };
  // The parent prompt's saved results (the rail), the prompt owner (for delete
  // permission), which assistant messages we've already saved, and the in-flight
  // result delete.
  const [results, setResults] = useState<SavedResult[]>([]);
  const [promptOwnerId, setPromptOwnerId] = useState<string | null>(null);
  const [savedMsgIds, setSavedMsgIds] = useState<Set<string>>(new Set());
  const [deletingResultId, setDeletingResultId] = useState<string | null>(null);
  // The conversation whose messages we already hold locally (we just created it),
  // so the load effect won't refetch it — idempotent, so StrictMode's double effect
  // invocation can't issue a stray GET the way a one-shot "skip" flag would.
  const ownIdRef = useRef<string | null>(null);
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
      ownIdRef.current = null;
      setMessages([]);
      setTitle(t('chats.newChat'));
      return;
    }
    // Already holding this chat's messages locally (we just created it) — don't refetch.
    if (ownIdRef.current === id) return;
    ownIdRef.current = null;
    let cancelled = false;
    api<Conversation>(`/conversations/${id}`)
      .then((c) => {
        if (cancelled) return;
        setMessages(c.messages);
        setTitle(c.title);
        setProvider(c.provider);
        setModel(c.model);
        // The parent prompt this chat belongs to (if any) gates answer-saving.
        setSource(c.originPromptId ?? null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : t('chats.couldNotLoad')));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // "Open in chat" passes the prompt body + provider model as navigation state.
  // Prefill the composer and picker; the user still chooses when to send.
  useEffect(() => {
    const draft = seedChatDraft(location.state as ChatSeedState, provider);
    if (draft && !seedUsedRef.current) {
      seedUsedRef.current = true;
      setInput(draft.input);
      setProvider(draft.provider);
      setModel(draft.model);
      setSource(draft.originPromptId ?? null);
    }
  }, [location.state, provider]);

  // Load the parent prompt's saved results (the rail) whenever the chat's parent
  // prompt changes. Cleared when the chat has no parent.
  useEffect(() => {
    if (!sourcePromptId) {
      setResults([]);
      setPromptOwnerId(null);
      return;
    }
    let cancelled = false;
    api<Prompt>(`/prompts/${sourcePromptId}`)
      .then((p) => {
        if (cancelled) return;
        setResults(p.results);
        setPromptOwnerId(p.createdBy.id);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [sourcePromptId]);

  // Track the chat's origin (e.g. the prompt it was opened from) so the breadcrumb
  // reads "Prompts / <title>". `send` re-passes it through its replace-navigate, so
  // it survives the /chats → /chats/:id transition; a plain history nav clears it.
  useEffect(() => {
    const st = location.state as { from?: ChatOrigin } | null;
    let from = st?.from ?? null;
    if (!from && id) {
      // Reopened from history within this session — recover the saved origin.
      try {
        const saved = sessionStorage.getItem(`lyra.chat.origin.${id}`);
        if (saved) from = JSON.parse(saved) as ChatOrigin;
      } catch { /* ignore */ }
    }
    originRef.current = from;
    setOrigin(from);
  }, [location.state, id]);

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
      if (!isAllowedMedia(file.type, file.name)) { setError(`${file.name}: ${t('chats.fileTypeNotAllowed')}`); continue; }
      if (file.size > MEDIA_MAX_BYTES) { setError(`${file.name}: ${t('chats.fileTooLarge')}`); continue; }
      setUploading((u) => u + 1);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const media = await api<PromptMedia>(`/workspaces/${wsId}/files`, { method: 'POST', body: fd });
        setAttachments((a) => [...a, media]);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('chats.couldNotUpload', { name: file.name }));
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
      setTitle(t('chats.newChat'));
      setInput('');
      setAttachments([]);
      setSource(null);
      return;
    }
    navigate('/chats');
  }

  const send = useCallback(
    async (text: string, media: PromptMedia[], opts?: { provider?: Provider; model?: string }) => {
      if ((!text.trim() && media.length === 0) || streaming || !wsId) return;
      // Allow an explicit provider·model (used by "Open in chat" so the run uses the
      // prompt's stored model regardless of whether the picker state has settled yet).
      const sendProvider = opts?.provider ?? provider;
      const sendModel = opts?.model ?? model;
      setError(null);
      atBottomRef.current = true;
      const now = new Date().toISOString();
      const userMsg: ConversationMessage = {
        id: `tmp-u-${++idRef.current}`, role: 'user', content: text, media, provider: sendProvider, model: sendModel, createdAt: now,
      };
      const aiMsg: ConversationMessage = {
        id: `tmp-a-${++idRef.current}`, role: 'assistant', content: '', provider: sendProvider, model: sendModel, createdAt: now,
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
          // A chat opened from a prompt is linked to it on creation (its parent).
          const convo = await api<Conversation>(`/workspaces/${wsId}/conversations`, {
            method: 'POST',
            body: JSON.stringify({
              provider: sendProvider,
              model: sendModel,
              originPromptId: originPromptIdRef.current ?? undefined,
            }),
          });
          cid = convo.id;
          createdNow = true;
        } catch (e) {
          patchLast({ error: e instanceof Error ? e.message : t('chats.couldNotStart') });
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
          { provider: sendProvider, model: sendModel, content: text, media },
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
              patchLast({ error: String(evt.message ?? t('chats.chatFailed')) });
              setStreaming(false);
              abortRef.current?.abort();
            }
          },
          ctrl.signal,
        );
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          patchLast({ error: e instanceof Error ? e.message : t('chats.chatFailed') });
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
          // Commit the new chat to its own URL now that it has content. We already
          // hold its messages, so mark it owned (no refetch). Re-pass the origin via
          // nav state, and stash it by id so reopening from history recovers the
          // "Prompts / <title>" breadcrumb too.
          ownIdRef.current = cid;
          if (originRef.current) {
            try {
              sessionStorage.setItem(`lyra.chat.origin.${cid}`, JSON.stringify(originRef.current));
            } catch { /* ignore */ }
          }
          navigate(`/chats/${cid}`, {
            replace: true,
            state: originRef.current ? { from: originRef.current } : undefined,
          });
        }
        loadList();
      }
    },
    [wsId, id, provider, model, streaming, navigate, loadList],
  );

  function stop() { abortRef.current?.abort(); }

  // Save an assistant answer as a child of the parent prompt. Gated on having a
  // parent (the button is disabled otherwise — Save as prompt is the gateway).
  async function saveAnswer(m: ConversationMessage) {
    if (!sourcePromptId || !m.content) return;
    try {
      const updated = await saveResult(sourcePromptId, {
        output: m.content,
        provider: m.provider,
        model: m.model,
        sourceConversationId: id,
      });
      setResults(updated.results);
      setSavedMsgIds((s) => new Set(s).add(m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('prompts.errSave'));
    }
  }

  // After "Save as prompt" creates the parent: link this chat to it, attach the
  // triggering answer as the first saved result, and surface the rail.
  async function afterSaveAsPrompt(prompt: Prompt, fromMsg: ConversationMessage) {
    setSaveFor(null);
    setSource(prompt.id);
    setPromptOwnerId(prompt.createdBy.id);
    setResults(prompt.results);
    if (id) {
      try {
        await api(`/conversations/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ originPromptId: prompt.id }),
        });
      } catch { /* ignore */ }
    }
    const idx = messages.findIndex((x) => x.id === fromMsg.id);
    const answer = idx >= 0 ? messages[idx + 1] : undefined;
    if (answer && answer.role === 'assistant' && answer.content) {
      try {
        const updated = await saveResult(prompt.id, {
          output: answer.content,
          provider: answer.provider,
          model: answer.model,
          sourceConversationId: id,
        });
        setResults(updated.results);
        setSavedMsgIds((s) => new Set(s).add(answer.id));
      } catch { /* ignore */ }
    }
    loadList();
  }

  async function onDeleteResult(rid: string) {
    if (!sourcePromptId) return;
    setDeletingResultId(rid);
    try {
      const updated = await deleteResult(sourcePromptId, rid);
      setResults(updated.results);
    } catch {
      /* ignore */
    } finally {
      setDeletingResultId(null);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function beginEdit(message: ConversationMessage) {
    setEditingMsgId(message.id);
    setEditingText(message.content);
  }

  function saveEdit() {
    if (!editingMsgId || !editingText.trim()) return;
    const nextText = editingText;
    setMessages((m) => updateMessageContent(m, editingMsgId, nextText));
    setSaveFor((current) =>
      current?.id === editingMsgId ? { ...current, content: nextText } : current,
    );
    setEditingMsgId(null);
    setEditingText('');
  }

  function cancelEdit() {
    setEditingMsgId(null);
    setEditingText('');
  }

  async function removeChat(c: ConversationSummary) {
    try {
      await api(`/conversations/${c.id}`, { method: 'DELETE' });
      setList((l) => l.filter((x) => x.id !== c.id));
      if (c.id === id) navigate('/chats', { replace: true });
    } catch { /* ignore */ }
  }

  return (
    <div className={`chat ${showHistory ? 'history-open' : ''} ${sourcePromptId ? 'has-results' : ''}`}>
      {showHistory && <div className="chat-scrim" onClick={() => setShowHistory(false)} />}

      <aside className="chat-history">
        <button className="chat-new" onClick={newChat}>
          <PlusIcon /> {t('chats.newChat')}
        </button>
        <button className="lin-ai-btn chat-copilot" onClick={() => setCopilotOpen(true)} title={t('copilot.title')}>
          <span aria-hidden>✨</span> <span className="lin-ai-txt">{t('copilot.title')}</span>
        </button>
        <div className="chat-history-list">
          {list.length === 0 ? (
            <p className="pg-empty">{t('chats.noChatsYet')}</p>
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
                  <span className="cl-sub">{modelLabel(catalog, c.provider, c.model)} · {t('chats.messageCount', { count: c.messageCount })}</span>
                </button>
                <button className="cl-del" onClick={() => void removeChat(c)} title={t('chats.deleteChat')} aria-label={t('chats.deleteChat')}>
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-top">
          <button className="chat-back chat-menu" onClick={openNav} aria-label={t('chats.openMenu')} title={t('chats.menu')}>
            <img src="/lyra-mark-squircle.svg" alt={t('chats.menu')} width={24} height={24} />
          </button>
          <div className="pg-headinfo">
            <div className="pg-headtitle">
              {origin && (
                <>
                  <Link to={origin.to} className="chat-crumb">{origin.label}</Link>
                  <span className="chat-crumb-sep">/</span>
                </>
              )}
              <span className="pg-name">{origin ? origin.record : id ? title : t('chats.newChat')}</span>
            </div>
          </div>
          <button
            className="cicon chat-close"
            onClick={() => navigate(origin?.to ?? '/')}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <XIcon />
          </button>
        </header>

        {error && <p className="error" style={{ margin: '0 16px' }}>{error}</p>}

        <div className="chat-scroll" ref={scrollRef} onScroll={onThreadScroll}>
          <div className="chat-thread">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <h3>{t('chats.startAChat')}</h3>
                <p>{t('chats.startAChatHint')}</p>
              </div>
            ) : (
              messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                if (m.role === 'user') {
                  const editingThis = editingMsgId === m.id;
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
                        {editingThis ? (
                          <div className="cmsg-editor">
                            <textarea
                              className="text-input cmsg-editarea"
                              value={editingText}
                              rows={Math.min(10, Math.max(3, editingText.split('\n').length + 1))}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                  e.preventDefault();
                                  saveEdit();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                              }}
                              autoFocus
                            />
                            <div className="cmsg-edit-actions">
                              <button type="button" className="btn-ghost mini" onClick={cancelEdit}>
                                {t('common.cancel')}
                              </button>
                              <button
                                type="button"
                                className="btn-primary mini"
                                disabled={!editingText.trim()}
                                onClick={saveEdit}
                              >
                                {t('common.save')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="cbubble">{m.content}</div>
                        )}
                        <div className="cactions">
                          <button
                            className="cicon"
                            onClick={() => copy(m.content)}
                            title={copied ? t('common.copied') : t('chats.copyPrompt')}
                            aria-label={t('chats.copyPrompt')}
                          >
                            <IconCopy />
                          </button>
                          <button
                            className="cicon"
                            onClick={() => beginEdit(m)}
                            title={t('chats.editPrompt')}
                            aria-label={t('chats.editPrompt')}
                            disabled={streaming}
                          >
                            <IconEdit />
                          </button>
                          <button className="cmsg-save" onClick={() => setSaveFor(m)} title={t('chats.saveToLibrary')}>
                            <IconBookmark /> {t('chats.saveAsPrompt')}
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
                          <button className="cicon" onClick={() => copy(m.content)} title={copied ? t('common.copied') : t('common.copy')}><IconCopy /></button>
                          {/* Save only when the chat has a parent prompt. Otherwise the
                              gateway is "Save as prompt" on the instruction above. */}
                          {sourcePromptId && (
                            <button
                              className="cmsg-save"
                              onClick={() => void saveAnswer(m)}
                              disabled={savedMsgIds.has(m.id)}
                              title={t('prompts.saveAnswerHint')}
                            >
                              <IconBookmark /> {savedMsgIds.has(m.id) ? t('prompts.answerSaved') : t('prompts.saveAnswer')}
                            </button>
                          )}
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
            placeholder={t('chats.composerPlaceholder')}
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

      {sourcePromptId && (
        <aside className="chat-results">
          <SavedResults
            results={results}
            onDelete={onDeleteResult}
            canDelete={(r) => !!user && (r.createdBy.id === user.id || promptOwnerId === user.id)}
            deletingId={deletingResultId}
          />
        </aside>
      )}

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
          onSaved={(prompt) => void afterSaveAsPrompt(prompt, saveFor)}
        />
      )}

      {copilotOpen && wsId && <CopilotPanel wsId={wsId} onClose={() => setCopilotOpen(false)} />}
    </div>
  );
}

function Attachment({ m }: { m: PromptMedia }) {
  const { t } = useTranslation();
  if (m.type === MediaType.Image) {
    return (
      <a href={m.url} target="_blank" rel="noreferrer" className="cmedia-thumb">
        <img src={m.url} alt={m.name ?? t('chats.imageFallback')} />
      </a>
    );
  }
  const c = tagColor(m.name ?? m.url);
  return (
    <a href={m.url} target="_blank" rel="noreferrer" className="cmedia-file" style={{ color: c, background: `${c}14`, borderColor: `${c}40` } as CSSProperties}>
      {m.name ?? t('chats.fileFallback')}
    </a>
  );
}
