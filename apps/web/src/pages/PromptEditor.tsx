import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  defaultModel,
  isAllowedMedia,
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
  PromptStatus,
  Provider,
  type Prompt,
  type PromptMedia,
  type TagCount,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useModels } from '../lib/useModels';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { TagInput } from '../components/TagInput';
import { AttachmentPreviews } from '../components/AttachmentPreviews';
import { ModelPicker } from '../components/ModelPicker';
import { Markdown } from '../components/Markdown';

interface FormState {
  title: string;
  content: string;
  status: PromptStatus;
  media: PromptMedia[];
  tags: string[];
  provider: Provider;
  model: string;
}
const emptyForm: FormState = {
  title: '',
  content: '',
  status: PromptStatus.Draft,
  media: [],
  tags: [],
  provider: Provider.Anthropic,
  model: defaultModel(Provider.Anthropic),
};

export function PromptEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();
  const { catalog } = useModels(wsId);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [vocab, setVocab] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wsId) return;
    api<TagCount[]>(`/workspaces/${wsId}/prompts/tags`).then(setVocab).catch(() => undefined);
  }, [wsId]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<Prompt>(`/prompts/${id}`)
      .then((p) => {
        if (user && p.createdBy.id !== user.id) {
          setDenied(true);
          return;
        }
        const provider = p.provider ?? Provider.Anthropic;
        setForm({
          title: p.title,
          content: p.content,
          status: p.status,
          media: [...p.media],
          tags: [...p.tags],
          provider,
          model: p.model ?? defaultModel(provider),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load prompt'))
      .finally(() => setLoading(false));
  }, [id, user]);

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
        setForm((f) => ({ ...f, media: [...f.media, media] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not upload ${file.name}`);
      } finally {
        setUploading((u) => u - 1);
      }
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !form.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        await api<Prompt>(`/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(form) });
      } else {
        await api<Prompt>(`/workspaces/${wsId}/prompts`, { method: 'POST', body: JSON.stringify(form) });
      }
      navigate('/prompts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prompt');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">Loading…</p>;
  if (denied) {
    return (
      <div className="pe">
        <div className="pe-top">
          <Link to="/prompts" className="pe-back">‹ Prompts</Link>
        </div>
        <p className="empty">You can only edit prompts you created.</p>
      </div>
    );
  }

  return (
    <form className="pe" onSubmit={onSubmit}>
      <div className="pe-top">
        <Link to="/prompts" className="pe-back">‹ Prompts</Link>
        <span className="pe-here">{isEdit ? 'Edit prompt' : 'New prompt'}</span>
        <span className="pe-spacer" />
        <button type="button" className="btn-ghost pe-btn" onClick={() => navigate('/prompts')}>Cancel</button>
        <button type="submit" className="btn-primary pe-btn" disabled={busy || !form.title.trim()}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create prompt'}
        </button>
      </div>

      {error && <p className="error pe-error">{error}</p>}

      {/* one white framed panel: title, tags+toggle row, then the composer */}
      <div className="pe-frame">
        <input
          className="pe-title"
          placeholder="Prompt title"
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        {/* tags (left) + Public toggle (right), one row, no labels */}
        <div className="pe-row">
          <div className="pe-tags">
            <TagInput value={form.tags} suggestions={vocab} onChange={(tags) => setForm({ ...form, tags })} />
          </div>
          <label className="pe-toggle" title="Public prompts can be reused across the workspace">
            <span className="pe-toggle-text">Public</span>
            <input
              type="checkbox"
              checked={form.status === PromptStatus.Public}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? PromptStatus.Public : PromptStatus.Draft })}
            />
            <span className="pe-track"><span className="pe-knob" /></span>
          </label>
        </div>

        <div className="pe-tabs">
          <button type="button" className={mode === 'write' ? 'on' : ''} onClick={() => setMode('write')}>Write</button>
          <button type="button" className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>Preview</button>
        </div>

        {/* bordered box for the input + result, with the model picker (matches the chat) */}
        <div className="composer-box pe-composer">
          <div className="pe-content">
            <AttachmentPreviews
              media={form.media}
              uploading={uploading}
              onRemove={(idx) => setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }))}
            />

            {mode === 'write' ? (
              <textarea
                className="pe-editor"
                placeholder="Prompt content. Use {product}, {niche}, {homepage} placeholders."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            ) : (
              <div className="pe-preview">
                {form.content.trim() ? (
                  <Markdown>{form.content}</Markdown>
                ) : (
                  <p className="pe-preview-empty">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="pe-bar">
            <button type="button" className="composer-add" onClick={() => fileRef.current?.click()} title="Attach files">+</button>
            <input ref={fileRef} type="file" hidden multiple accept={MEDIA_ACCEPT} onChange={(e) => { void uploadFiles(e.target.files); e.target.value = ''; }} />
            <ModelPicker
              catalog={catalog}
              provider={form.provider}
              model={form.model}
              onChange={(provider, model) => setForm((f) => ({ ...f, provider, model }))}
            />
            <span className="pe-counter">{form.content.length.toLocaleString()} chars</span>
          </div>
        </div>
      </div>
    </form>
  );
}
