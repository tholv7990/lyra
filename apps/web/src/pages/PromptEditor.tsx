import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  isAllowedMedia,
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
  PromptStatus,
  type Prompt,
  type PromptMedia,
  type TagCount,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { TagInput } from '../components/TagInput';
import { AttachmentPreviews } from '../components/AttachmentPreviews';

interface FormState {
  title: string;
  content: string;
  status: PromptStatus;
  media: PromptMedia[];
  tags: string[];
}
const emptyForm: FormState = {
  title: '',
  content: '',
  status: PromptStatus.Draft,
  media: [],
  tags: [],
};

export function PromptEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [vocab, setVocab] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
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
        setForm({ title: p.title, content: p.content, status: p.status, media: [...p.media], tags: [...p.tags] });
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
      <div className="editor">
        <Link to="/prompts" className="pg-back">← Prompts</Link>
        <p className="empty">You can only edit prompts you created.</p>
      </div>
    );
  }

  return (
    <div className="editor">
      <Link to="/prompts" className="pg-back">← Prompts</Link>
      <h2 className="editor-title">{isEdit ? 'Edit prompt' : 'New prompt'}</h2>

      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit}>
        <input
          className="pe-title"
          placeholder="Prompt title"
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <div className="composer-box pe-composer">
          <AttachmentPreviews
            media={form.media}
            uploading={uploading}
            onRemove={(idx) => setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }))}
          />
          <textarea
            className="composer-input"
            placeholder="Prompt content. Use {product}, {niche}, {homepage} placeholders."
            rows={8}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="composer-bar">
            <button type="button" className="composer-add" onClick={() => fileRef.current?.click()} title="Attach files">+</button>
            <input ref={fileRef} type="file" hidden multiple accept={MEDIA_ACCEPT} onChange={(e) => { void uploadFiles(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {/* tags (left) + visibility toggle (right) on one row, no labels */}
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

        <div className="editor-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate('/prompts')}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={busy || !form.title.trim()} style={{ width: 'auto', marginTop: 0 }}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create prompt'}
          </button>
        </div>
      </form>
    </div>
  );
}
