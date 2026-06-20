import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isAllowedMedia,
  MEDIA_MAX_BYTES,
  MediaType,
  type Conversation,
  type ConversationMessage,
  type Prompt,
  type PromptMedia,
  type Provider,
} from '@lyra/shared';
import { api, streamSSE } from '../lib/api';
import type { ModelCatalog } from '../lib/useModels';
import { Composer } from './Composer';
import { Markdown } from './Markdown';
import { ProviderIcon } from './ProviderIcon';
import { PlayIcon } from '../layout/icons';

function modelLabel(catalog: ModelCatalog, provider: Provider, model: string) {
  return catalog[provider]?.find((m) => m.id === model)?.label ?? model;
}

export interface StepTestModalProps {
  wsId: string;
  title: string;
  promptId?: string;
  initialPrompt: string;
  initialMedia: PromptMedia[];
  provider: Provider;
  model: string;
  catalog: ModelCatalog;
  onClose: () => void;
}

export function StepTestModal({
  wsId,
  title,
  promptId,
  initialPrompt,
  initialMedia,
  provider: initialProvider,
  model: initialModel,
  catalog,
  onClose,
}: StepTestModalProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [input, setInput] = useState(initialPrompt);
  const [media, setMedia] = useState<PromptMedia[]>(initialMedia);
  const [uploading, setUploading] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!promptId || initialPrompt.trim() || input.trim() || messages.length > 0) return;
    let cancelled = false;
    api<Prompt>(`/prompts/${promptId}`)
      .then((prompt) => {
        if (cancelled) return;
        setInput(prompt.content);
        if (media.length === 0) setMedia(prompt.media ?? []);
      })
      .catch((e) => {
        if (!cancelled) {
          setInput(title);
          if (!(e instanceof Error && e.message === 'Prompt not found')) {
            setError(e instanceof Error ? e.message : 'Could not load prompt');
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [promptId, initialPrompt, input, messages.length, media.length]);

  async function uploadFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!isAllowedMedia(file.type, file.name)) {
        setError(`${file.name}: file type not allowed`);
        continue;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        setError(`${file.name}: exceeds 25 MB`);
        continue;
      }
      setUploading((u) => u + 1);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const uploaded = await api<PromptMedia>(`/workspaces/${wsId}/files`, { method: 'POST', body: fd });
        setMedia((m) => [...m, uploaded]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not upload ${file.name}`);
      } finally {
        setUploading((u) => u - 1);
      }
    }
  }

  async function send() {
    if ((!input.trim() && media.length === 0) || streaming) return;
    setError(null);
    const now = new Date().toISOString();
    const userMsg: ConversationMessage = {
      id: `tmp-u-${++idRef.current}`,
      role: 'user',
      content: input,
      media,
      provider,
      model,
      createdAt: now,
    };
    const assistantMsg: ConversationMessage = {
      id: `tmp-a-${++idRef.current}`,
      role: 'assistant',
      content: '',
      provider,
      model,
      createdAt: now,
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput('');
    setMedia([]);
    setStreaming(true);

    const patchLast = (patch: Partial<ConversationMessage>) =>
      setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)));

    let cid = conversationId;
    if (!cid) {
      try {
        const convo = await api<Conversation>(`/workspaces/${wsId}/conversations`, {
          method: 'POST',
          body: JSON.stringify({ provider, model }),
        });
        cid = convo.id;
        setConversationId(cid);
      } catch (e) {
        patchLast({ error: e instanceof Error ? e.message : 'Could not start chat' });
        setStreaming(false);
        return;
      }
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamSSE(
        `/conversations/${cid}/messages`,
        { provider, model, content: userMsg.content, media: userMsg.media ?? [] },
        (evt) => {
          if (evt.type === 'delta') {
            setMessages((m) =>
              m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + String(evt.text ?? '') } : x)),
            );
          } else if (evt.type === 'done') {
            const msg = evt.message as ConversationMessage | null;
            if (msg) patchLast(msg);
            setStreaming(false);
            abortRef.current?.abort();
          } else if (evt.type === 'error') {
            patchLast({ error: String(evt.message ?? 'Test failed') });
            setStreaming(false);
            abortRef.current?.abort();
          }
        },
        ctrl.signal,
      );
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        patchLast({ error: e instanceof Error ? e.message : 'Test failed' });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function renderAssistantContent(message: ConversationMessage) {
    if (message.error) return message.error;
    if (message.content) return <Markdown>{message.content}</Markdown>;
    return streaming ? '' : null;
  }

  return (
    <div className="step-test">
      <div className="step-test-main">
        <header className="step-test-top">
          <button type="button" className="eshell-back step-test-back" onClick={onClose} aria-label={t('run.closeTest')}>
            &lsaquo;
          </button>
          <div className="step-test-title">
            <span className="step-test-kicker">{t('run.stepTest')}</span>
            <h2>{t('run.testTitle', { title })}</h2>
            <span className="step-test-model">
              <ProviderIcon provider={provider} size={14} />
              {modelLabel(catalog, provider, model)}
            </span>
          </div>
        </header>

        {error && <p className="error step-test-error">{error}</p>}

        <div className="step-test-scroll">
          <div className="step-test-thread">
            {messages.length === 0 ? (
              <div className="chat-empty step-test-empty">
                <span className="step-test-empty-ico" aria-hidden><PlayIcon width={22} height={22} /></span>
                <h3>{t('run.testThisNode')}</h3>
                <p>{t('run.testNodeHint')}</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="cmsg">
                  <div className={`cavatar ${m.role === 'user' ? 'user' : ''}`}>
                    {m.role === 'user' ? 'You' : <ProviderIcon provider={m.provider} size={28} />}
                  </div>
                  <div className="cbody">
                    <div className="cmsg-meta">
                      <ProviderIcon provider={m.provider} size={14} />
                      {modelLabel(catalog, m.provider, m.model)}
                    </div>
                    {m.media && m.media.length > 0 && (
                      <div className="cmedia">
                        {m.media.map((md, i) => <StepTestAttachment key={`${md.url}-${i}`} media={md} />)}
                      </div>
                    )}
                    {m.role === 'user' ? (
                      <div className="cbubble">{m.content}</div>
                    ) : (
                      <div className={`ctext ${m.error ? 'err' : ''}`}>
                        {renderAssistantContent(m)}
                        {streaming && !m.content && <span className="pg-caret" />}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-composer step-test-composer">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            placeholder={t('run.testPromptPlaceholder')}
            autoFocus
            media={media}
            onRemoveMedia={(idx) => setMedia((m) => m.filter((_, i) => i !== idx))}
            uploading={uploading}
            onFiles={(files) => void uploadFiles(files)}
            catalog={catalog}
            provider={provider}
            model={model}
            onModelChange={(p, mdl) => {
              setProvider(p);
              setModel(mdl);
            }}
            busy={streaming}
            onStop={stop}
            canSubmit={!!input.trim() || media.length > 0}
          />
        </div>
      </div>
    </div>
  );
}

function StepTestAttachment({ media }: { media: PromptMedia }) {
  if (media.type === MediaType.Image) {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className="cmedia-thumb">
        <img src={media.url} alt={media.name ?? 'image'} />
      </a>
    );
  }
  return (
    <a href={media.url} target="_blank" rel="noreferrer" className="cmedia-file" style={{ color: 'var(--primary)' } as CSSProperties}>
      {media.name ?? 'file'}
    </a>
  );
}
