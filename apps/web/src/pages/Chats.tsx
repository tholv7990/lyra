import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  defaultModel,
  Provider,
  type ConversationMessage,
  type ConversationSummary,
  type Prompt,
  type SavedResult,
} from '@lyra/shared';
import { api } from '../lib/api';
import { saveResult, deleteResult } from '../lib/promptResults';
import { SavedResults } from '../components/SavedResults';
import { useModels, type ModelCatalog } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ChatPane } from '../components/ChatPane';
import { ProviderIcon } from '../components/ProviderIcon';
import { SaveAsPromptModal } from '../components/SaveAsPromptModal';
import { CopilotPanel } from '../components/CopilotPanel';
import { ListIcon, PlusIcon, TrashIcon, XIcon } from '../layout/icons';
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
  const [title, setTitle] = useState(t('chats.newChat'));
  const [origin, setOrigin] = useState<ChatOrigin | null>(null);
  // Mirror origin in a ref so the page can carry it through ChatPane's onCreated
  // navigate without needing the latest value baked into a closure.
  const originRef = useRef<ChatOrigin | null>(null);
  useBreadcrumb(
    origin ? origin.record : id ? title : t('chats.title'),
    origin ? { label: origin.label, to: origin.to } : null,
  );

  const [showHistory, setShowHistory] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [saveFor, setSaveFor] = useState<ConversationMessage | null>(null);
  // The answer paired with the message being saved-as-prompt, so the new prompt is
  // born with that answer as its first saved result (ChatPane hands it to us).
  const pendingAnswerRef = useRef<ConversationMessage | null>(null);
  // Page-level errors for the save/results actions (ChatPane owns the chat-core banner).
  const [saveError, setSaveError] = useState<string | null>(null);

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
  const seedUsedRef = useRef(false);
  const loadList = useCallback(() => {
    if (!wsId) return;
    api<ConversationSummary[]>(`/workspaces/${wsId}/conversations`)
      .then(setList)
      .catch(() => setList([]));
  }, [wsId]);

  useEffect(() => loadList(), [loadList]);

  // Fresh canvas (no :id): reset the page title/source. ChatPane loads an existing
  // conversation's messages/title/provider/model/source itself when `id` is set.
  useEffect(() => {
    if (!id) { setTitle(t('chats.newChat')); setSource(null); seedUsedRef.current = false; }
  }, [id]);

  // "Open in chat" passes the prompt body + provider·model as navigation state.
  // ChatPane seeds the composer/provider/model via props; here we only carry the
  // page-level `source` (the parent prompt) so the results rail and answer-saving work.
  useEffect(() => {
    const d = seedChatDraft(location.state as ChatSeedState, Provider.Anthropic);
    if (d && !seedUsedRef.current) { seedUsedRef.current = true; setSource(d.originPromptId ?? null); }
  }, [location.state]);

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

  function newChat() {
    setShowHistory(false);
    if (!id) {
      // already on a fresh canvas
      setTitle(t('chats.newChat'));
      setSource(null);
      return;
    }
    navigate('/chats');
  }

  // Save an assistant answer as a child of the parent prompt. Gated on having a
  // parent (the button is disabled otherwise — Save as prompt is the gateway).
  // The message carries its own provider·model (stamped at send time).
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
      setSaveError(e instanceof Error ? e.message : t('prompts.errSave'));
    }
  }

  // After "Save as prompt" creates the parent: link this chat to it, surface the rail,
  // and attach the triggering answer (handed to us by ChatPane) as its first result.
  async function afterSaveAsPrompt(prompt: Prompt) {
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
    const answer = pendingAnswerRef.current;
    pendingAnswerRef.current = null;
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
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : t('prompts.errSave'));
      }
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

  async function removeChat(c: ConversationSummary) {
    try {
      await api(`/conversations/${c.id}`, { method: 'DELETE' });
      setList((l) => l.filter((x) => x.id !== c.id));
      if (c.id === id) navigate('/chats', { replace: true });
    } catch { /* ignore */ }
  }

  // "Open in chat" seeds the composer + provider·model once via ChatPane's props.
  const draft = seedChatDraft(location.state as ChatSeedState, Provider.Anthropic);

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
          {/* Mobile-only: open the conversation-list drawer (desktop shows it as a
              permanent pane, so the CSS hides this there). */}
          <button
            className="cicon chat-history-btn"
            onClick={() => setShowHistory(true)}
            aria-label={t('chats.openHistory')}
            title={t('chats.openHistory')}
          >
            <ListIcon />
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

        {saveError && <p className="error" style={{ margin: '0 16px' }}>{saveError}</p>}

        <ChatPane
          wsId={wsId ?? ''}
          catalog={catalog}
          initialProvider={draft?.provider ?? Provider.Anthropic}
          initialModel={draft?.model ?? defaultModel(Provider.Anthropic)}
          seedInput={draft?.input}
          conversationId={id}
          createBody={{ originPromptId: sourcePromptId ?? undefined }}
          onCreated={(cid) => {
            if (originRef.current) { try { sessionStorage.setItem(`lyra.chat.origin.${cid}`, JSON.stringify(originRef.current)); } catch { /* ignore */ } }
            navigate(`/chats/${cid}`, { replace: true, state: originRef.current ? { from: originRef.current } : undefined });
          }}
          onTitle={setTitle}
          onSource={setSource}
          onActivity={loadList}
          userName={user?.name}
          allowEdit
          onSaveAsPrompt={(m, answer) => { pendingAnswerRef.current = answer ?? null; setSaveError(null); setSaveFor(m); }}
          onSaveAnswer={(m) => void saveAnswer(m)}
          isAnswerSaved={(m) => savedMsgIds.has(m.id) || results.some((r) => r.output === m.content)}
          emptyState={<div className="chat-empty"><h3>{t('chats.startAChat')}</h3><p>{t('chats.startAChatHint')}</p></div>}
        />
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
          onSaved={(prompt) => void afterSaveAsPrompt(prompt)}
        />
      )}

      {copilotOpen && wsId && <CopilotPanel wsId={wsId} onClose={() => setCopilotOpen(false)} />}
    </div>
  );
}
