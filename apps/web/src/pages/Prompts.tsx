import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  isAllowedMedia,
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
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
import { AttachmentPreviews } from '../components/AttachmentPreviews';
import { PromptsIcon, PlusIcon } from '../layout/icons';

const STATUS_COLOR: Record<PromptStatus, string> = {
  [PromptStatus.Draft]: '#d4a72c',
  [PromptStatus.Public]: '#2da44e',
};
const STATUS_LABEL: Record<PromptStatus, string> = {
  [PromptStatus.Draft]: 'Draft',
  [PromptStatus.Public]: 'Public',
};
const PAGE_SIZE = 15;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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

  // filters (Linear-style: search always visible, status/tag added via + Filter)
  const [status, setStatus] = useState<PromptStatus | ''>('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [vocab, setVocab] = useState<TagCount[]>([]);
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // create/edit modal
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [toDelete, setToDelete] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!status || !!tag || !!q.trim();

  useEffect(() => setPage(1), [status, tag, q]);

  // close the filter menu on outside click
  useEffect(() => {
    if (!filterMenu) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterMenu]);

  const buildQuery = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (tag) params.set('tag', tag);
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  };

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    const query = buildQuery();
    const timer = setTimeout(() => {
      api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${query}`)
        .then((res) => {
          if (cancelled) return;
          setPrompts(res.items);
          setTotal(res.total);
        })
        .catch(() => !cancelled && setPrompts([]))
        .finally(() => !cancelled && setLoading(false));
    }, 220);
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

  function reload() {
    if (!wsId) return;
    api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${buildQuery()}`)
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
      </div>

      {/* Linear-style filter toolbar */}
      <div className="lin-toolbar">
        <input
          className="lin-search"
          placeholder="Search prompts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {status && (
          <span className="lin-chip">
            Status: {STATUS_LABEL[status]}
            <button className="lin-chip-x" onClick={() => setStatus('')} aria-label="Remove">×</button>
          </span>
        )}
        {tag && (
          <span className="lin-chip">
            Tag: {tag}
            <button className="lin-chip-x" onClick={() => setTag('')} aria-label="Remove">×</button>
          </span>
        )}
        <div className="lin-filter" ref={filterRef}>
          <button className="lin-filter-btn" onClick={() => setFilterMenu((s) => !s)}>+ Filter</button>
          {filterMenu && (
            <div className="lin-menu">
              <div className="lin-menu-label">Status</div>
              {[PromptStatus.Draft, PromptStatus.Public].map((s) => (
                <button key={s} className="lin-menu-item" onClick={() => { setStatus(s); setFilterMenu(false); }}>
                  <span className="dot" style={{ background: STATUS_COLOR[s] }} />
                  {STATUS_LABEL[s]}
                </button>
              ))}
              {vocab.length > 0 && <div className="lin-menu-label">Tag</div>}
              {vocab.slice(0, 12).map((t) => (
                <button key={t.value} className="lin-menu-item" onClick={() => { setTag(t.value); setFilterMenu(false); }}>
                  <span className="dot" style={{ background: tagColor(t.value) }} />
                  {t.value} <span className="lin-menu-count">{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {hasFilters && (
          <button className="lin-clear" onClick={() => { setStatus(''); setTag(''); setQ(''); }}>Clear</button>
        )}
        <button className="lin-add" onClick={openCreate} title="New prompt" aria-label="New prompt">
          <PlusIcon />
        </button>
      </div>

      {error && !editing && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading prompts…</p>
      ) : prompts.length === 0 ? (
        !hasFilters ? (
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
          <div className="ptable">
            <div className="ptable-head">
              <span>Name</span>
              <span>Status</span>
              <span>Tags</span>
              <span>Updated</span>
              <span />
            </div>
            {prompts.map((p) => (
              <div className="prow" key={p.id}>
                <button className="prow-name" onClick={() => (canEdit(p) ? openEdit(p) : undefined)}>
                  <span className="nm">{p.title}</span>
                  {p.content && <span className="snip">{p.content}</span>}
                </button>
                <span>
                  <span className={`badge status-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                </span>
                <span className="prow-tags">
                  {p.tags.slice(0, 3).map((t) => {
                    const c = tagColor(t);
                    return (
                      <span key={t} className="tag-chip ro" style={{ color: c, borderColor: `${c}55`, background: `${c}14` } as CSSProperties}>
                        {t}
                      </span>
                    );
                  })}
                  {p.tags.length > 3 && <span className="more">+{p.tags.length - 3}</span>}
                </span>
                <span className="prow-date">{fmtDate(p.updatedAt)}</span>
                <span className="prow-actions">
                  <Link className="txt-btn accent" to={`/prompts/${p.id}/test`}>Test</Link>
                  {canEdit(p) && (
                    <>
                      <button className="txt-btn" onClick={() => toggleStatus(p)} title={p.status === PromptStatus.Public ? 'Unpublish' : 'Publish'}>
                        {p.status === PromptStatus.Public ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="txt-btn" onClick={() => openEdit(p)}>Edit</button>
                      <button className="txt-btn danger" onClick={() => setToDelete(p)}>Delete</button>
                    </>
                  )}
                </span>
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

            <div className="pf-field">
              <span className="pf-label">Prompt</span>
              <div className="composer-box modal-composer">
                <AttachmentPreviews
                  media={form.media}
                  uploading={uploading}
                  onRemove={(idx) => setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }))}
                />
                <textarea
                  className="composer-input"
                  placeholder="Prompt content. Use {product}, {niche}, {homepage} placeholders."
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
                <div className="composer-bar">
                  <button type="button" className="composer-add" onClick={() => fileRef.current?.click()} title="Attach files">+</button>
                  <input ref={fileRef} type="file" hidden multiple accept={MEDIA_ACCEPT} onChange={(e) => { void uploadFiles(e.target.files); e.target.value = ''; }} />
                </div>
              </div>
            </div>

            <div className="pf-field">
              <span className="pf-label">Tags</span>
              <TagInput value={form.tags} suggestions={vocab} onChange={(tags) => setForm({ ...form, tags })} />
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
