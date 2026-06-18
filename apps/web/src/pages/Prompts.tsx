import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PromptStatus,
  Provider,
  defaultModel,
  labelColor,
  type Paged,
  type ProviderCount,
  type PromptAuthorCount,
  type Prompt,
  type TagCount,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { useLabels } from '../lib/useLabels';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LabelPicker } from '../components/LabelPicker';
import { PromptDetails } from '../components/PromptDetails';
import { ProviderIcon } from '../components/ProviderIcon';
import { ChatsIcon, EyeIcon, PromptsIcon, PlusIcon, XIcon } from '../layout/icons';

const STATUS_COLOR: Record<PromptStatus, string> = {
  [PromptStatus.Draft]: '#d4a72c',
  [PromptStatus.Public]: '#2da44e',
};
const STATUS_LABEL: Record<PromptStatus, string> = {
  [PromptStatus.Draft]: 'Draft',
  [PromptStatus.Public]: 'Public',
};
const PROVIDER_LABEL: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
};
const PAGE_SIZE = 15;

interface PromptQueryOptions {
  page: number;
  limit: number;
  statuses: PromptStatus[];
  tags: string[];
  createdBy: string[];
  providers: Provider[];
  q: string;
}

export function buildPromptQuery({
  page,
  limit,
  statuses,
  tags,
  createdBy,
  providers,
  q,
}: PromptQueryOptions) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  statuses.forEach((s) => params.append('status', s));
  tags.forEach((t) => params.append('tag', t));
  createdBy.forEach((id) => params.append('createdBy', id));
  providers.forEach((p) => params.append('provider', p));
  if (q.trim()) params.set('q', q.trim());
  return params.toString();
}

function fmtDate(iso: string) {
  const parts = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return [month, day, year].filter(Boolean).join(' ');
}

function initial(name?: string) {
  return name?.trim().charAt(0).toUpperCase() || '?';
}

function avatarStyle(name?: string): CSSProperties {
  const c = labelColor(name || 'User', []);
  return { color: c, background: `${c}16` };
}

export function Prompts() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const wsId = current?.id;
  const { labels, createLabel } = useLabels(wsId);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters (Linear-style: search always visible, status/tag added via + Filter)
  const [statuses, setStatuses] = useState<PromptStatus[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [createdBy, setCreatedBy] = useState<string[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [q, setQ] = useState('');
  const [vocab, setVocab] = useState<TagCount[]>([]);
  const [creators, setCreators] = useState<PromptAuthorCount[]>([]);
  const [providerVocab, setProviderVocab] = useState<[Provider, number][]>([]);
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [toDelete, setToDelete] = useState<Prompt | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number | null>(null);
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<{ id: string; val: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = statuses.length + tags.length + createdBy.length + providers.length;
  const hasFilters = statuses.length > 0 || tags.length > 0 || createdBy.length > 0 || providers.length > 0 || !!q.trim();

  useEffect(() => setPage(1), [statuses, tags, createdBy, providers, q]);

  // close the filter menu on outside click
  useEffect(() => {
    if (!filterMenu) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterMenu]);

  const buildQuery = () =>
    buildPromptQuery({ page, limit: PAGE_SIZE, statuses, tags, createdBy, providers, q });

  // Filter vocabularies (tags / creators / providers) are loaded from dedicated
  // endpoints that span the WHOLE visible library — never derived from the
  // current filtered/paginated page — so the filter options stay stable as you
  // narrow other filters. Refreshed after an inline edit changes a tag/provider.
  const loadVocab = useCallback(() => {
    if (!wsId) return;
    api<TagCount[]>(`/workspaces/${wsId}/prompts/tags`).then(setVocab).catch(() => undefined);
    api<PromptAuthorCount[]>(`/workspaces/${wsId}/prompts/creators`).then(setCreators).catch(() => undefined);
    api<ProviderCount[]>(`/workspaces/${wsId}/prompts/providers`)
      .then((list) => setProviderVocab(list.map((x) => [x.provider, x.count] as [Provider, number])))
      .catch(() => undefined);
  }, [wsId]);

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
  }, [wsId, page, statuses, tags, createdBy, providers, q]);

  useEffect(loadVocab, [loadVocab]);

  const canEdit = (p: Prompt) => !!user && p.createdBy.id === user.id;

  function reload() {
    if (!wsId) return;
    api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?${buildQuery()}`)
      .then((res) => { setPrompts(res.items); setTotal(res.total); })
      .catch(() => undefined);
  }

  async function patchPrompt(p: Prompt, body: Record<string, unknown>) {
    try {
      const updated = await api<Prompt>(`/prompts/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setPrompts((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      setDetailPrompt((current) => (current?.id === updated.id ? updated : current));
      // A tag/provider/status edit can change the vocabularies — refresh them
      // from the full-library endpoints so the filter options stay correct.
      loadVocab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update prompt');
      throw err;
    }
  }

  function toggleStatus(p: Prompt) {
    void patchPrompt(p, {
      status: p.status === PromptStatus.Public ? PromptStatus.Draft : PromptStatus.Public,
    });
  }

  function toggleFilterValue<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  function commitTitle(p: Prompt) {
    const val = editing?.val.trim() ?? '';
    setEditing(null);
    if (val && val !== p.title) void patchPrompt(p, { title: val });
  }

  // Open a prompt in a new chat: go to the chat page with the prompt's content +
  // provider·model carried in nav state. The conversation is created lazily on the
  // first send — so tapping a prompt doesn't litter history with empty chats, and
  // Back returns cleanly to the prompt list (no double-create on a slow mobile tap).
  function openInChat(p: Prompt) {
    const prov = p.provider ?? Provider.Anthropic;
    navigate('/chats', {
      state: {
        seed: p.content,
        provider: prov,
        model: p.model ?? defaultModel(prov),
        // origin breadcrumb: the chat shows "Prompts / <title>" and links back here
        from: { label: 'Prompts', to: '/prompts', record: p.title },
      },
    });
  }

  // Open the delete confirm, and check how many pipelines use the prompt so we
  // can warn that those steps would be left empty (the dangling-ref bug class).
  function askDelete(p: Prompt) {
    setToDelete(p);
    setDeleteUsage(null);
    if (wsId) {
      api<{ count: number }>(`/workspaces/${wsId}/pipelines/prompt-usage/${p.id}`)
        .then((r) => setDeleteUsage(r.count))
        .catch(() => setDeleteUsage(null));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/prompts/${toDelete.id}`, { method: 'DELETE' });
      setToDelete(null);
      setDeleteUsage(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete prompt');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Linear-style filter toolbar */}
      <div className="lin-toolbar">
        <input
          className="lin-search"
          placeholder="Search prompts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="lin-filter" ref={filterRef}>
          <button
            className={`lin-filter-btn ${filterCount > 0 || filterMenu ? 'active' : ''}`}
            onClick={() => setFilterMenu((s) => !s)}
          >
            + Filter{filterCount > 0 && <> <span className="lin-filter-count">{filterCount}</span></>}
          </button>
          {filterMenu && (
            <div className="lin-menu">
              <div className="lin-menu-actions">
                <button
                  type="button"
                  className="lin-menu-clear"
                  disabled={filterCount === 0}
                  onClick={() => {
                    setStatuses([]);
                    setTags([]);
                    setProviders([]);
                    setCreatedBy([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="lin-menu-label">Status</div>
              {[PromptStatus.Draft, PromptStatus.Public].map((s) => (
                <button key={s} className="lin-menu-item" onClick={() => setStatuses((list) => toggleFilterValue(list, s))}>
                  <span className="dot" style={{ background: STATUS_COLOR[s] }} />
                  {STATUS_LABEL[s]}
                  {statuses.includes(s) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              <details className="lin-menu-section">
                <summary className="lin-menu-summary">
                  <span>Tags</span>
                  {tags.length > 0 && <span className="lin-menu-summary-count">{tags.length}</span>}
                </summary>
                {vocab.length === 0 && <div className="lin-menu-empty">No prompt tags</div>}
                {vocab.map((t) => (
                  <button key={t.value} className="lin-menu-item" onClick={() => setTags((list) => toggleFilterValue(list, t.value))}>
                    <span className="dot" style={{ background: labelColor(t.value, labels) }} />
                    {t.value} <span className="lin-menu-count">{t.count}</span>
                    {tags.includes(t.value) && <span className="lin-menu-check">✓</span>}
                  </button>
                ))}
              </details>
              {providerVocab.length > 0 && <div className="lin-menu-label">Provider</div>}
              {providerVocab.map(([provider, count]) => (
                <button key={provider} className="lin-menu-item" onClick={() => setProviders((list) => toggleFilterValue(list, provider))}>
                  <ProviderIcon provider={provider} size={14} />
                  {PROVIDER_LABEL[provider]} <span className="lin-menu-count">{count}</span>
                  {providers.includes(provider) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              {creators.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>Created by</span>
                    {createdBy.length > 0 && <span className="lin-menu-summary-count">{createdBy.length}</span>}
                  </summary>
                  {creators.map((creator) => (
                    <button key={creator.id} className="lin-menu-item" onClick={() => setCreatedBy((list) => toggleFilterValue(list, creator.id))}>
                      <span className="dot" style={{ background: labelColor(creator.name, []) }} />
                      {creator.name} <span className="lin-menu-count">{creator.count}</span>
                      {createdBy.includes(creator.id) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>
        <button className="lin-add" onClick={() => navigate('/prompts/new')} title="New prompt" aria-label="New prompt">
          <PlusIcon />
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading prompts…</p>
      ) : prompts.length === 0 ? (
        !hasFilters ? (
          <div className="prompt-empty">
            <div className="prompt-empty-art"><PromptsIcon width={26} height={26} /></div>
            <h3>Build your prompt library</h3>
            <p>Save reusable prompts, tag them, and use them as steps in your pipelines.</p>
            <button className="btn-primary" onClick={() => navigate('/prompts/new')}>Create your first prompt</button>
          </div>
        ) : (
          <p className="empty">No prompts match these filters.</p>
        )
      ) : (
        <>
          <div className="ptable">
            {prompts.map((p) => {
              const editable = canEdit(p);
              return (
                <div className="prow" key={p.id}>
                  {editing?.id === p.id ? (
                    <input
                      className="prow-edit"
                      autoFocus
                      value={editing.val}
                      onChange={(e) => setEditing({ id: p.id, val: e.target.value })}
                      onBlur={() => commitTitle(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitTitle(p); }
                        else if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <div className="prow-namecell">
                      <button
                        type="button"
                        className="prow-name"
                        title={editable ? 'Click to rename' : p.title}
                        onClick={() => (editable ? setEditing({ id: p.id, val: p.title }) : openInChat(p))}
                      >
                        <span className="nm">{p.title}</span>
                      </button>
                      {p.content && (
                        <span className="prow-sniprow">
                          <span className="snip">{p.content}</span>
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="prow-eye"
                    title="View full prompt"
                    aria-label={`View full prompt for ${p.title}`}
                    onClick={() => setDetailPrompt(p)}
                  >
                    <EyeIcon width={15} height={15} />
                  </button>

                  <span className="prow-tags">
                    {editable ? (
                      <LabelPicker
                        value={p.tags}
                        labels={labels}
                        onChange={(tags) => void patchPrompt(p, { tags })}
                        onCreate={createLabel}
                      />
                    ) : (
                      <>
                        {p.tags.slice(0, 3).map((t) => (
                          <span key={t} className="tag-chip ro">
                            <span className="tdot" style={{ background: labelColor(t, labels) }} />
                            {t}
                          </span>
                        ))}
                        {p.tags.length > 3 && <span className="more">+{p.tags.length - 3}</span>}
                      </>
                    )}
                  </span>

                  <span className="prow-status">
                    {editable ? (
                      <button
                        type="button"
                        className={`badge status-${p.status} badge-btn`}
                        onClick={() => toggleStatus(p)}
                        title="Toggle Draft / Public"
                      >
                        {STATUS_LABEL[p.status]}
                      </button>
                    ) : (
                      <span className={`badge status-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                    )}
                  </span>

                  <span className="prow-facts">
                    {p.provider && p.model && (
                      <span className="prow-provider">
                        <ProviderIcon provider={p.provider} size={14} />
                        {p.model}
                      </span>
                    )}
                    <span className="prow-date" title={`Updated by ${p.updatedBy.name}`}>
                      <span
                        className="prow-updated-icon"
                        style={avatarStyle(p.updatedBy.name)}
                        aria-hidden="true"
                      >
                        {initial(p.updatedBy.name)}
                      </span>
                      {fmtDate(p.updatedAt)}
                    </span>
                  </span>

                  <span className="prow-actions">
                    <button
                      className="prow-chat"
                      onClick={() => openInChat(p)}
                      title="Open in chat"
                      aria-label={`Open ${p.title} in chat`}
                    >
                      <ChatsIcon width={15} height={15} />
                    </button>
                    {editable && (
                      <button
                        className="prow-delete"
                        onClick={() => askDelete(p)}
                        title="Delete prompt"
                        aria-label={`Delete ${p.title}`}
                      >
                        <XIcon width={14} height={14} />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="pager-info">Page {page} of {totalPages} · {total} total</span>
            <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete prompt?"
        message={
          <>
            <strong>{toDelete?.title}</strong> will be removed from the library. This can’t be undone.
            {deleteUsage != null && deleteUsage > 0 && (
              <span className="confirm-warn">
                ⚠ Used by {deleteUsage} pipeline{deleteUsage === 1 ? '' : 's'} — those steps will be left empty.
              </span>
            )}
          </>
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => { setToDelete(null); setDeleteUsage(null); }}
      />
      {detailPrompt && (
        <PromptDetails
          prompt={detailPrompt}
          labels={labels}
          canEdit={canEdit(detailPrompt)}
          onSaveContent={(content) => patchPrompt(detailPrompt, { content })}
          onClose={() => setDetailPrompt(null)}
        />
      )}
    </div>
  );
}
