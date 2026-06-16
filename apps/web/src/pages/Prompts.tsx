import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  MediaType,
  PromptStatus,
  STEP_COLORS,
  StepKey,
  type Prompt,
  type PromptMedia,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';

const TYPE_LABELS: Record<StepKey, string> = {
  [StepKey.Find]: 'Find',
  [StepKey.Crawl]: 'Crawl',
  [StepKey.Brief]: 'Brief',
  [StepKey.Insight]: 'Insight',
  [StepKey.Prompts]: 'Prompts',
  [StepKey.Images]: 'Images',
  [StepKey.Video]: 'Video',
  [StepKey.QA]: 'QA',
};
const TYPES = Object.values(StepKey);

const MEDIA_LABELS: Record<MediaType, string> = {
  [MediaType.Image]: 'Image',
  [MediaType.Audio]: 'Audio',
  [MediaType.Video]: 'Video',
  [MediaType.File]: 'File',
};
const MEDIA_TYPES = Object.values(MediaType);

interface FormState {
  title: string;
  content: string;
  type: StepKey;
  status: PromptStatus;
  media: PromptMedia[];
}
const emptyForm: FormState = {
  title: '',
  content: '',
  type: StepKey.Brief,
  status: PromptStatus.Draft,
  media: [],
};

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null;

export function Prompts() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StepKey | 'all'>('all');
  const [toDelete, setToDelete] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add-media inputs (staged before being added to form.media).
  const [mType, setMType] = useState<MediaType>(MediaType.Image);
  const [mUrl, setMUrl] = useState('');
  const [mName, setMName] = useState('');

  const wsId = current?.id;

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Prompt[]>(`/workspaces/${wsId}/prompts`)
      .then((list) => !cancelled && setPrompts(list))
      .catch(() => !cancelled && setPrompts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const visible = useMemo(
    () => (filter === 'all' ? prompts : prompts.filter((p) => p.type === filter)),
    [prompts, filter],
  );

  const canEdit = (p: Prompt) => !!user && p.createdBy.id === user.id;

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setEditing({ kind: 'new' });
  }

  function openEdit(p: Prompt) {
    setForm({
      title: p.title,
      content: p.content,
      type: p.type,
      status: p.status,
      media: [...p.media],
    });
    setError(null);
    setEditing({ kind: 'edit', id: p.id });
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setMUrl('');
    setMName('');
    setError(null);
  }

  function addMedia() {
    const url = mUrl.trim();
    if (!url) return;
    setForm((f) => ({
      ...f,
      media: [...f.media, { type: mType, url, name: mName.trim() || undefined }],
    }));
    setMUrl('');
    setMName('');
  }

  function removeMedia(idx: number) {
    setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !form.title.trim() || !editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.kind === 'new') {
        const created = await api<Prompt>(`/workspaces/${wsId}/prompts`, {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setPrompts((p) => [created, ...p]);
      } else {
        const updated = await api<Prompt>(`/prompts/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setPrompts((p) => p.map((x) => (x.id === updated.id ? updated : x)));
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prompt');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(p: Prompt) {
    const next =
      p.status === PromptStatus.Public ? PromptStatus.Draft : PromptStatus.Public;
    try {
      const updated = await api<Prompt>(`/prompts/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setPrompts((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update prompt');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/prompts/${toDelete.id}`, { method: 'DELETE' });
      setPrompts((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete prompt');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="section-head">
        <h2>Prompts</h2>
        {!editing && (
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            onClick={openCreate}
          >
            New prompt
          </button>
        )}
      </div>

      {!editing && (
        <div className="type-filter">
          <button
            className={`type-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              className={`type-chip ${filter === t ? 'active' : ''}`}
              onClick={() => setFilter(t)}
            >
              <span className="dot" style={{ background: STEP_COLORS[t] }} />
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <form className="form-inline" onSubmit={onSubmit}>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <input
            className="text-input"
            placeholder="Title"
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <div className="form-row">
            <label className="field">
              <span className="field-label">Type</span>
              <select
                className="text-input"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as StepKey })
                }
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Status</span>
              <div className="seg">
                <button
                  type="button"
                  className={form.status === PromptStatus.Draft ? 'on' : ''}
                  onClick={() => setForm({ ...form, status: PromptStatus.Draft })}
                >
                  Draft
                </button>
                <button
                  type="button"
                  className={form.status === PromptStatus.Public ? 'on' : ''}
                  onClick={() => setForm({ ...form, status: PromptStatus.Public })}
                >
                  Public
                </button>
              </div>
            </label>
          </div>

          <textarea
            className="text-input prompt-area"
            placeholder="Prompt content. Use {product}, {niche}, {homepage} placeholders."
            rows={5}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />

          <div className="field-label">Media (sent to the AI provider)</div>
          {form.media.length > 0 && (
            <div className="media-chips">
              {form.media.map((m, i) => (
                <span className="media-chip" key={`${m.url}-${i}`}>
                  <span className="media-kind">{MEDIA_LABELS[m.type]}</span>
                  <span className="media-name">{m.name || m.url}</span>
                  <button
                    type="button"
                    className="media-x"
                    aria-label="Remove"
                    onClick={() => removeMedia(i)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="media-add">
            <select
              className="text-input select-sm"
              value={mType}
              onChange={(e) => setMType(e.target.value as MediaType)}
            >
              {MEDIA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEDIA_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              className="text-input"
              placeholder="https://… URL"
              value={mUrl}
              onChange={(e) => setMUrl(e.target.value)}
            />
            <input
              className="text-input"
              placeholder="Label (optional)"
              value={mName}
              onChange={(e) => setMName(e.target.value)}
            />
            <button className="btn-ghost" type="button" onClick={addMedia}>
              Add
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-primary"
              type="submit"
              disabled={busy}
              style={{ marginTop: 0 }}
            >
              {busy
                ? 'Saving…'
                : editing.kind === 'new'
                  ? 'Create prompt'
                  : 'Save changes'}
            </button>
            <button className="btn-ghost" type="button" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && !editing && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading prompts…</p>
      ) : visible.length === 0 ? (
        <p className="empty">
          {prompts.length === 0
            ? 'No prompts yet. Create your first one.'
            : 'No prompts of this type.'}
        </p>
      ) : (
        <div className="prompt-grid">
          {visible.map((p) => (
            <div
              className="prompt-card"
              key={p.id}
              style={{ borderLeftColor: STEP_COLORS[p.type] }}
            >
              <div className="prompt-card-head">
                <span className="prompt-card-title">{p.title}</span>
                <span
                  className="badge ptype"
                  style={{
                    color: STEP_COLORS[p.type],
                    borderColor: `${STEP_COLORS[p.type]}55`,
                    background: `${STEP_COLORS[p.type]}14`,
                  }}
                >
                  <span className="dot" style={{ background: STEP_COLORS[p.type] }} />
                  {TYPE_LABELS[p.type]}
                </span>
                <span className={`badge status-${p.status}`}>
                  {p.status === PromptStatus.Public ? 'Public' : 'Draft'}
                </span>
              </div>

              {p.content && <div className="prompt-body">{p.content}</div>}

              {p.media.length > 0 && (
                <div className="media-chips">
                  {p.media.map((m, i) => (
                    <span className="media-chip ro" key={`${m.url}-${i}`}>
                      <span className="media-kind">{MEDIA_LABELS[m.type]}</span>
                      <span className="media-name">{m.name || m.url}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="prompt-card-foot">
                <span className="prompt-by">by {p.createdBy.name}</span>
                {canEdit(p) && (
                  <div className="row-actions" style={{ marginLeft: 'auto' }}>
                    <button className="btn-ghost" onClick={() => toggleStatus(p)}>
                      {p.status === PromptStatus.Public ? 'Unpublish' : 'Publish'}
                    </button>
                    <button className="btn-ghost" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button className="btn-danger" onClick={() => setToDelete(p)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete prompt?"
        message={
          <>
            <strong>{toDelete?.title}</strong> will be removed from the library.
            This can’t be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
