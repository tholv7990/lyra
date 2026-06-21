import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  isAllowedMedia,
  MEDIA_MAX_BYTES,
  MediaType,
  tagColor,
  type Conversation,
  type ConversationMessage,
  type PromptMedia,
  type Provider,
} from '@lyra/shared';
import { api, streamSSE } from '../lib/api';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';
import { initials } from '../lib/format';
import type { ModelCatalog } from '../lib/useModels';
import { Composer } from './Composer';
import { Markdown } from './Markdown';
import { ProviderIcon } from './ProviderIcon';

function modelLabel(catalog: ModelCatalog, provider: Provider, model: string) {
  return catalog[provider]?.find((m) => m.id === model)?.label ?? model;
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

export interface ChatPaneProps {
  wsId: string;
  catalog: ModelCatalog;
  initialProvider: Provider;
  initialModel: string;
  /** Prefill the composer once (step-test seeds the step prompt; "Open in chat" seeds a prompt). */
  seedInput?: string;
  seedMedia?: PromptMedia[];
  /** Resume an existing conversation — loads its messages (skips the one just created locally). */
  conversationId?: string;
  /** Extra fields merged into POST /conversations (e.g. `{ originPromptId }`). */
  createBody?: Record<string, unknown>;
  /** Called after the first send commits the new conversation (page navigates to it). */
  onCreated?: (id: string) => void;
  /** The stream's title (on `done`) and the loaded conversation's title. */
  onTitle?: (title: string) => void;
  /** The conversation's parent prompt id, learned on load (drives the page's results rail). */
  onSource?: (originPromptId: string | null) => void;
  /** Fired after every send so the page can refresh its history list. */
  onActivity?: () => void;
  emptyState?: ReactNode;
  composerPlaceholder?: string;
  autoFocus?: boolean;
  /** Name for the user-bubble avatar initials; defaults to "You". */
  userName?: string;
  /** Enable inline editing of user messages (Chats). */
  allowEdit?: boolean;
  /** Per user-message "Save as prompt" action (Chats); receives the paired answer if present. */
  onSaveAsPrompt?: (m: ConversationMessage, answer?: ConversationMessage) => void;
  /** Per assistant-answer "Save answer" action + its saved state (Chats, with a parent prompt). */
  onSaveAnswer?: (m: ConversationMessage) => void;
  isAnswerSaved?: (m: ConversationMessage) => boolean;
}

/**
 * The reusable chat conversation surface: streaming engine (lazy conversation-create + SSE),
 * the message thread, and the Composer. Rendered by the Chats page (wrapped in its sidebar /
 * breadcrumb / results chrome) and by the step-test popup (wrapped in a modal shell). All the
 * page-specific behaviour is injected via props so this stays the single source of truth.
 */
export function ChatPane({
  wsId,
  catalog,
  initialProvider,
  initialModel,
  seedInput,
  seedMedia,
  conversationId,
  createBody,
  onCreated,
  onTitle,
  onSource,
  onActivity,
  emptyState,
  composerPlaceholder,
  autoFocus,
  userName,
  allowEdit,
  onSaveAsPrompt,
  onSaveAnswer,
  isAnswerSaved,
}: ChatPaneProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [provider, setProvider] = useState(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [input, setInput] = useState(seedInput ?? '');
  const [attachments, setAttachments] = useState<PromptMedia[]>(seedMedia ?? []);
  const [uploading, setUploading] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const { copied, copy } = useCopyToClipboard();

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const idRef = useRef(0);
  // The conversation whose messages we already hold (we just created it), so the load
  // effect won't refetch — idempotent against StrictMode's double effect invocation.
  const ownIdRef = useRef<string | null>(null);
  // Seeded synchronously above when the seed is known at mount; the effect only
  // covers a seed that resolves later (StepTest fetching the prompt by id).
  const seededRef = useRef(Boolean(seedInput) || !!(seedMedia && seedMedia.length));

  // Latest callbacks in a ref so the load effect (keyed only on conversationId) never
  // captures a stale closure and never re-runs just because the parent re-rendered.
  const cb = useRef({ onCreated, onTitle, onSource, onActivity });
  cb.current = { onCreated, onTitle, onSource, onActivity };

  // Prefill the composer once from the seed (step prompt / open-in-chat draft).
  useEffect(() => {
    if (seededRef.current) return;
    if ((seedInput && seedInput.length > 0) || (seedMedia && seedMedia.length > 0)) {
      seededRef.current = true;
      if (seedInput) setInput(seedInput);
      if (seedMedia && seedMedia.length) setAttachments(seedMedia);
    }
  }, [seedInput, seedMedia]);

  // Load the selected conversation (skip the one we just created locally).
  useEffect(() => {
    if (!conversationId) {
      ownIdRef.current = null;
      setMessages([]);
      return;
    }
    if (ownIdRef.current === conversationId) return;
    ownIdRef.current = null;
    let cancelled = false;
    api<Conversation>(`/conversations/${conversationId}`)
      .then((c) => {
        if (cancelled) return;
        setMessages(c.messages);
        setProvider(c.provider);
        setModel(c.model);
        cb.current.onTitle?.(c.title);
        cb.current.onSource?.(c.originPromptId ?? null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : t('chats.couldNotLoad')));
    return () => {
      cancelled = true;
    };
  }, [conversationId, t]);

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

      let cid = conversationId;
      let createdNow = false;
      if (!cid) {
        try {
          const convo = await api<Conversation>(`/workspaces/${wsId}/conversations`, {
            method: 'POST',
            body: JSON.stringify({ provider, model, ...createBody }),
          });
          cid = convo.id;
          createdNow = true;
        } catch (e) {
          setMessages((m) => m.filter((x) => x.id !== userMsg.id && x.id !== aiMsg.id));
          setInput(text);
          setAttachments(media);
          setError(e instanceof Error ? e.message : t('chats.couldNotStart'));
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
              setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + String(evt.text ?? '') } : x)));
            } else if (evt.type === 'done') {
              const msg = evt.message as ConversationMessage | null;
              if (msg) patchLast(msg);
              if (evt.title) cb.current.onTitle?.(String(evt.title));
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
          if (streamOpened) patchLast({ error: e instanceof Error ? e.message : t('chats.chatFailed') });
          else setError(e instanceof Error ? e.message : t('chats.chatFailed'));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        if (!streamOpened) {
          // Failed before anything streamed (e.g. the provider has no key): roll back the
          // optimistic bubbles, hand the text back, and discard the empty chat we just made.
          setMessages((m) => m.filter((x) => x.id !== userMsg.id && x.id !== aiMsg.id));
          setInput(text);
          setAttachments(media);
          if (createdNow && cid) {
            try { await api(`/conversations/${cid}`, { method: 'DELETE' }); } catch { /* ignore */ }
          }
        } else if (createdNow && cid) {
          ownIdRef.current = cid;
          cb.current.onCreated?.(cid);
        }
        cb.current.onActivity?.();
      }
    },
    [wsId, conversationId, provider, model, streaming, createBody, t],
  );

  function stop() { abortRef.current?.abort(); }

  function beginEdit(m: ConversationMessage) { setEditingMsgId(m.id); setEditingText(m.content); }
  function saveEdit() {
    if (!editingMsgId || !editingText.trim()) return;
    const next = editingText;
    setMessages((m) => m.map((x) => (x.id === editingMsgId ? { ...x, content: next } : x)));
    setEditingMsgId(null);
    setEditingText('');
  }
  function cancelEdit() { setEditingMsgId(null); setEditingText(''); }

  return (
    <>
      {error && <p className="error" style={{ margin: '0 16px' }}>{error}</p>}

      <div className="chat-scroll" ref={scrollRef} onScroll={onThreadScroll}>
        <div className="chat-thread">
          {messages.length === 0 ? (
            emptyState ?? null
          ) : (
            messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === 'user') {
                const editingThis = editingMsgId === m.id;
                return (
                  <div key={m.id} className="cmsg user">
                    <div className="cavatar user">{userName ? initials(userName) : 'You'}</div>
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
                              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                              else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                            }}
                            autoFocus
                          />
                          <div className="cmsg-edit-actions">
                            <button type="button" className="btn-ghost mini" onClick={cancelEdit}>{t('common.cancel')}</button>
                            <button type="button" className="btn-primary mini" disabled={!editingText.trim()} onClick={saveEdit}>{t('common.save')}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="cbubble">{m.content}</div>
                      )}
                      {(onSaveAsPrompt || allowEdit) && !editingThis && (
                        <div className="cactions">
                          <button className="cicon" onClick={() => copy(m.content)} title={copied ? t('common.copied') : t('chats.copyPrompt')} aria-label={t('chats.copyPrompt')}>
                            <IconCopy />
                          </button>
                          {allowEdit && (
                            <button className="cicon" onClick={() => beginEdit(m)} title={t('chats.editPrompt')} aria-label={t('chats.editPrompt')} disabled={streaming}>
                              <IconEdit />
                            </button>
                          )}
                          {onSaveAsPrompt && (
                            <button className="cmsg-save" onClick={() => onSaveAsPrompt(m, messages[i + 1])} title={t('chats.saveToLibrary')}>
                              <IconBookmark /> {t('chats.saveAsPrompt')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              const done = !!m.content && !m.error && !(streaming && isLast);
              const answerSaved = !!isAnswerSaved?.(m);
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
                        {onSaveAnswer && (
                          <button className="cmsg-save" onClick={() => onSaveAnswer(m)} disabled={answerSaved} title={t('prompts.saveAnswerHint')}>
                            <IconBookmark /> {answerSaved ? t('prompts.answerSaved') : t('prompts.saveAnswer')}
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
          placeholder={composerPlaceholder ?? t('chats.composerPlaceholder')}
          autoFocus={autoFocus}
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
    </>
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
