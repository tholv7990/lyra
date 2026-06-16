import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  MediaType,
  PromptStatus,
  STEP_COLORS,
  StepKey,
  tagColor,
  type Prompt,
  type PromptMedia,
  type TagCount,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TagInput } from '../components/TagInput';
import { FileUpload } from '../components/FileUpload';
import { PromptsIcon } from '../layout/icons';

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

function extLabel(name?: string): string {
  if (!name) return 'FILE';
  const i = name.lastIndexOf('.');
  return (i >= 0 ? name.slice(i + 1) : 'file').toUpperCase().slice(0, 4);
}

const STATUS_COLORS: Record<PromptStatus, string> = {
  [PromptStatus.Draft]: '#d4a72c',
  [PromptStatus.Public]: '#2da44e',
};

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

interface FormState {
  title: string;
  content: string;
  type: StepKey;
  status: PromptStatus;
  media: PromptMedia[];
  tags: string[];
}
const emptyForm: FormState = {
  title: '',
  content: '',
  type: StepKey.Brief,
  status: PromptStatus.Draft,
  media: [],
  tags: [],
};

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null;

export function Prompts() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [vocab, setVocab] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StepKey | 'all'>('all');
  const [toDelete, setToDelete] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const wsId = current?.id;

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Prompt[]>(`/workspaces/${wsId}/prompts`)
      .then((list) => !cancelled && setPrompts(list))
      .catch(() => !cancelled && setPrompts([]))
      .finally(() => !cancelled && setLoading(false));
    api<TagCount[]>(`/workspaces/${wsId}/prompts/tags`)
      .then((v) => !cancelled && setVocab(v))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const refreshVocab = () => {
    if (!wsId) return;
    api<TagCount[]>(`/workspaces/${wsId}/prompts/tags`)
      .then(setVocab)
      .catch(() => undefined);
  };

  const counts = useMemo(() => {
    const m = {} as Record<StepKey, number>;
    for (const t of TYPES) m[t] = 0;
    for (const p of prompts) m[p.type] = (m[p.type] ?? 0) + 1;
    return m;
  }, [prompts]);

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
      tags: [...p.tags],
    });
    setError(null);
    setEditing({ kind: 'edit', id: p.id });
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
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
      refreshVocab();
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
      <div className="prompts-head">
        <div className="titles">
          <h2>Prompts</h2>
          <p>Reusable, on-brand prompts for every step of the pipeline.</p>
        </div>
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

      {!editing && prompts.length > 0 && (
        <div className="type-filter">
          <button
            className={`type-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span className="count">{prompts.length}</span>
          </button>
          {TYPES.filter((t) => counts[t] > 0).map((t) => {
            const active = filter === t;
            const style: CSSProperties | undefined = active
              ? {
                  color: STEP_COLORS[t],
                  borderColor: `${STEP_COLORS[t]}66`,
                  background: `${STEP_COLORS[t]}14`,
                }
              : undefined;
            return (
              <button
                key={t}
                className={`type-chip ${active ? 'active' : ''}`}
                style={style}
                onClick={() => setFilter(t)}
              >
                <span className="dot" style={{ background: STEP_COLORS[t] }} />
                {TYPE_LABELS[t]}
                <span className="count">{counts[t]}</span>
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <form className="form-inline prompt-form" onSubmit={onSubmit}>
          <p className="form-title">
            {editing.kind === 'new' ? 'New prompt' : 'Edit prompt'}
          </p>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <input
            className="text-input"
            placeholder="Title"
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <div className="form-row">
            <label className="pf-field">
              <span className="pf-label">Type</span>
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
            <div className="pf-field">
              <span className="pf-label">Status</span>
              <div className="seg">
                <button
                  type="button"
                  className={form.status === PromptStatus.Draft ? 'on' : ''}
                  onClick={() => setForm({ ...form, status: PromptStatus.Draft })}
                >
                  <span
                    className="pip"
                    style={{ background: STATUS_COLORS[PromptStatus.Draft] }}
                  />
                  Draft
                </button>
                <button
                  type="button"
                  className={form.status === PromptStatus.Public ? 'on' : ''}
                  onClick={() => setForm({ ...form, status: PromptStatus.Public })}
                >
                  <span
                    className="pip"
                    style={{ background: STATUS_COLORS[PromptStatus.Public] }}
                  />
                  Public
                </button>
              </div>
            </div>
          </div>

          <textarea
            className="text-input prompt-area"
            placeholder="Prompt content. Use {product}, {niche}, {homepage} placeholders."
            rows={5}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />

          <div className="pf-field">
            <span className="pf-label">Tags</span>
            <TagInput
              value={form.tags}
              suggestions={vocab}
              onChange={(tags) => setForm({ ...form, tags })}
            />
          </div>

          <div className="pf-field">
            <span className="pf-label">Attachments — sent to the AI provider</span>
            {wsId && (
              <FileUpload
                value={form.media}
                workspaceId={wsId}
                onAdd={(m) => setForm((f) => ({ ...f, media: [...f.media, m] }))}
                onRemove={(i) =>
                  setForm((f) => ({
                    ...f,
                    media: f.media.filter((_, idx) => idx !== i),
                  }))
                }
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-primary"
              type="submit"
              disabled={busy}
              style={{ marginTop: 0, width: 'auto' }}
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
      ) : prompts.length === 0 && !editing ? (
        <div className="prompt-empty">
          <div className="prompt-empty-art">
            <PromptsIcon width={26} height={26} />
          </div>
          <h3>Build your prompt library</h3>
          <p>
            Save reusable prompts for each step of the pipeline — briefs, insights,
            image and video directions — tagged by type and shared with your team.
          </p>
          <div className="prompt-empty-dots">
            {TYPES.map((t) => (
              <span key={t} className="d" style={{ background: STEP_COLORS[t] }} />
            ))}
          </div>
          <button className="btn-primary" onClick={openCreate}>
            Create your first prompt
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">No prompts of this type.</p>
      ) : (
        <div className="prompt-grid">
          {visible.map((p, i) => (
            <div
              className="prompt-card"
              key={p.id}
              style={
                {
                  '--accent': STEP_COLORS[p.type],
                  animationDelay: `${Math.min(i, 12) * 40}ms`,
                } as CSSProperties
              }
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

              {p.tags.length > 0 && (
                <div className="prompt-tags">
                  {p.tags.map((t) => {
                    const c = tagColor(t);
                    return (
                      <span
                        key={t}
                        className="tag-chip ro"
                        style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}
                      >
                        <span className="tdot" style={{ background: c }} />
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}

              {p.media.length > 0 && (
                <div className="card-media">
                  {p.media.map((m, idx) =>
                    m.type === MediaType.Image ? (
                      <a
                        key={`${m.url}-${idx}`}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="card-media-thumb"
                        title={m.name}
                      >
                        <img src={m.url} alt={m.name ?? 'image'} />
                      </a>
                    ) : (
                      <a
                        key={`${m.url}-${idx}`}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="card-media-file"
                        title={m.name}
                      >
                        <span className="ext">{extLabel(m.name)}</span>
                        <span className="nm">{m.name || MEDIA_LABELS[m.type]}</span>
                      </a>
                    ),
                  )}
                </div>
              )}

              <div className="prompt-card-foot">
                <span className="prompt-author">
                  <span className="av">{initials(p.createdBy.name)}</span>
                  {p.createdBy.name}
                </span>
                <div className="prompt-actions">
                  <Link className="txt-btn accent" to={`/prompts/${p.id}/test`}>
                    Test
                  </Link>
                  {canEdit(p) && (
                    <>
                      <button className="txt-btn" onClick={() => toggleStatus(p)}>
                        {p.status === PromptStatus.Public ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="txt-btn" onClick={() => openEdit(p)}>
                        Edit
                      </button>
                      <button className="txt-btn danger" onClick={() => setToDelete(p)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
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
