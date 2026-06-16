import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  MediaType,
  PromptStatus,
  tagColor,
  type Paged,
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

const STATUS_COLOR: Record<PromptStatus, string> = {
  [PromptStatus.Draft]: '#d4a72c',
  [PromptStatus.Public]: '#2da44e',
};

const PAGE_SIZE = 12;

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

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null;

export function Prompts() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // filters
  const [status, setStatus] = useState<'all' | PromptStatus>('all');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [vocab, setVocab] = useState<TagCount[]>([]);

  // create/edit modal
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [status, tag, q]);

  // Debounced, filtered, paginated fetch.
  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status !== 'all') params.set('status', status);
    if (tag) params.set('tag', tag);
    if (q.trim()) params.set('q', q.trim());
    const timer = setTimeout(() => {
      api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${params.toString()}`)
        .then((res) => {
          if (cancelled) return;
          setPrompts(res.items);
          setTotal(res.total);
        })
        .catch(() => !cancelled && setPrompts([]))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wsId, page, status, tag, q]);

  const refreshVocab = () => {
    if (!wsId) return;
    api<TagCount[]>(`/workspaces/${wsId}/prompts/tags`).then(setVocab).catch(() => undefined);
  };
  useEffect(refreshVocab, [wsId]);

  const canEdit = (p: Prompt) => !!user && p.createdBy.id === user.id;

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setEditing({ kind: 'new' });
  }
  function openEdit(p: Prompt) {
    setForm({ title: p.title, content: p.content, status: p.status, media: [...p.media], tags: [...p.tags] });
    setError(null);
    setEditing({ kind: 'edit', id: p.id });
  }
  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
  }

  // Re-fetch the current page after a mutation.
  function reload() {
    setPage((p) => p); // triggers effect via state identity? force via toggle below
    // simplest: bump a refetch by resetting page to itself won't trigger; call directly
    if (!wsId) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status !== 'all') params.set('status', status);
    if (tag) params.set('tag', tag);
    if (q.trim()) params.set('q', q.trim());
    api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${params.toString()}`)
      .then((res) => { setPrompts(res.items); setTotal(res.total); })
      .catch(() => undefined);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !form.title.trim() || !editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.kind === 'new') {
        await api<Prompt>(`/workspaces/${wsId}/prompts`, { method: 'POST', body: JSON.stringify(form) });
      } else {
        await api<Prompt>(`/prompts/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      }
      closeForm();
      reload();
      refreshVocab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prompt');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(p: Prompt) {
    const next = p.status === PromptStatus.Public ? PromptStatus.Draft : PromptStatus.Public;
    try {
      const updated = await api<Prompt>(`/prompts/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
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
      setToDelete(null);
      reload();
      refreshVocab();
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
          <p>Reusable, on-brand prompts for your pipelines.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} onClick={openCreate}>
          New prompt
        </button>
      </div>

      <div className="prompt-toolbar">
        <input
          className="text-input"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="text-input select-sm" value={status} onChange={(e) => setStatus(e.target.value as 'all' | PromptStatus)}>
          <option value="all">All statuses</option>
          <option value={PromptStatus.Draft}>Draft</option>
          <option value={PromptStatus.Public}>Public</option>
        </select>
        <select className="text-input select-sm" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {vocab.map((t) => (
            <option key={t.value} value={t.value}>{t.value} ({t.count})</option>
          ))}
        </select>
      </div>

      {error && !editing && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading prompts…</p>
      ) : prompts.length === 0 ? (
        total === 0 && status === 'all' && !tag && !q ? (
          <div className="prompt-empty">
            <div className="prompt-empty-art"><PromptsIcon width={26} height={26} /></div>
            <h3>Build your prompt library</h3>
            <p>Save reusable prompts, tag them, and use them as steps in your pipelines.</p>
            <button className="btn-primary" onClick={openCreate}>Create your first prompt</button>
          </div>
        ) : (
          <p className="empty">No prompts match these filters.</p>
        )
      ) : (
        <>
          <div className="prompt-grid">
            {prompts.map((p, i) => (
              <div
                className="prompt-card"
                key={p.id}
                style={{ '--accent': STATUS_COLOR[p.status], animationDelay: `${Math.min(i, 12) * 35}ms` } as CSSProperties}
              >
                <div className="prompt-card-head">
                  <span className="prompt-card-title">{p.title}</span>
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
                        <span key={t} className="tag-chip ro" style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}>
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
                        <a key={`${m.url}-${idx}`} href={m.url} target="_blank" rel="noreferrer" className="card-media-thumb" title={m.name}>
                          <img src={m.url} alt={m.name ?? 'image'} />
                        </a>
                      ) : (
                        <a key={`${m.url}-${idx}`} href={m.url} target="_blank" rel="noreferrer" className="card-media-file" title={m.name}>
                          <span className="ext">{extLabel(m.name)}</span>
                          <span className="nm">{m.name || MEDIA_LABELS[m.type]}</span>
                        </a>
                      ),
                    )}
                  </div>
                )}

                <div className="prompt-card-foot">
                  <span className="prompt-author">by {p.createdBy.name}</span>
                  <div className="prompt-actions">
                    <Link className="txt-btn accent" to={`/prompts/${p.id}/test`}>Test</Link>
                    {canEdit(p) && (
                      <>
                        <button className="txt-btn" onClick={() => toggleStatus(p)}>
                          {p.status === PromptStatus.Public ? 'Unpublish' : 'Publish'}
                        </button>
                        <button className="txt-btn" onClick={() => openEdit(p)}>Edit</button>
                        <button className="txt-btn danger" onClick={() => setToDelete(p)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="pager-info">Page {page} of {totalPages} · {total} total</span>
            <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}

      {/* Create / edit popup */}
      {editing && (
        <div className="modal-scrim" onClick={closeForm}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
            <div className="modal-head">
              <h3>{editing.kind === 'new' ? 'New prompt' : 'Edit prompt'}</h3>
              <button type="button" className="modal-x" onClick={closeForm} aria-label="Close">×</button>
            </div>

            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

            <input
              className="text-input"
              placeholder="Title"
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <div className="pf-field">
              <span className="pf-label">Status</span>
              <div className="seg">
                <button type="button" className={form.status === PromptStatus.Draft ? 'on' : ''} onClick={() => setForm({ ...form, status: PromptStatus.Draft })}>
                  <span className="pip" style={{ background: STATUS_COLOR[PromptStatus.Draft] }} />Draft
                </button>
                <button type="button" className={form.status === PromptStatus.Public ? 'on' : ''} onClick={() => setForm({ ...form, status: PromptStatus.Public })}>
                  <span className="pip" style={{ background: STATUS_COLOR[PromptStatus.Public] }} />Public
                </button>
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
              <TagInput value={form.tags} suggestions={vocab} onChange={(tags) => setForm({ ...form, tags })} />
            </div>

            <div className="pf-field">
              <span className="pf-label">Attachments</span>
              {wsId && (
                <FileUpload
                  value={form.media}
                  workspaceId={wsId}
                  onAdd={(m) => setForm((f) => ({ ...f, media: [...f.media, m] }))}
                  onRemove={(idx) => setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }))}
                />
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={busy} style={{ width: 'auto', marginTop: 0 }}>
                {busy ? 'Saving…' : editing.kind === 'new' ? 'Create prompt' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete prompt?"
        message={<><strong>{toDelete?.title}</strong> will be removed from the library. This can’t be undone.</>}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
