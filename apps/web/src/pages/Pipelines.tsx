import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { labelColor, type Pipeline } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { useLabels } from '../lib/useLabels';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LabelPicker } from '../components/LabelPicker';
import { PipelinesIcon, PlusIcon, XIcon } from '../layout/icons';

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

function avatarStyle(name?: string) {
  const c = labelColor(name || 'User', []);
  return { color: c, background: `${c}16` };
}

const PAGE_SIZE = 10;

export function pipelineNamePatch(current: string, draft: string): { name: string } | null {
  const name = draft.trim();
  if (!name || name === current) return null;
  return { name };
}

// Tag vocabulary for the filter menu: dedupe case-insensitively (first-seen
// display casing wins), count usages, sort by count then name. Mirrors how the
// Prompts page folds tag case so "Research" and "research" are one filter chip.
export function pipelineTagVocab(pipelines: Pipeline[]): [string, number][] {
  const byKey = new Map<string, { value: string; count: number }>();
  for (const p of pipelines) {
    for (const tag of p.tags) {
      const key = tag.toLowerCase();
      const existing = byKey.get(key);
      if (existing) existing.count += 1;
      else byKey.set(key, { value: tag, count: 1 });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .map((x) => [x.value, x.count]);
}

// Pure filter predicate: name search (case-insensitive substring), tags
// (OR within the group, case-insensitive), and creator (by id). Extracted so
// the filter semantics are unit-tested.
export function pipelineMatchesFilters(
  p: Pipeline,
  opts: { q: string; tags: string[]; creators: string[] },
): boolean {
  const query = opts.q.trim().toLowerCase();
  if (query && !p.name.toLowerCase().includes(query)) return false;
  if (opts.tags.length) {
    const selected = new Set(opts.tags.map((t) => t.toLowerCase()));
    if (!p.tags.some((tag) => selected.has(tag.toLowerCase()))) return false;
  }
  if (opts.creators.length && !opts.creators.includes(p.createdBy.id)) return false;
  return true;
}

export function Pipelines() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const { labels, createLabel } = useLabels(current?.id);
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [creatorFilters, setCreatorFilters] = useState<string[]>([]);
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Pipeline | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<{ id: string; val: string } | null>(null);

  const wsId = current?.id;

  const tagVocab = useMemo(() => pipelineTagVocab(pipelines), [pipelines]);

  const creatorVocab = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const p of pipelines) {
      const existing = byId.get(p.createdBy.id);
      if (existing) existing.count += 1;
      else byId.set(p.createdBy.id, { ...p.createdBy, count: 1 });
    }
    return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [pipelines]);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Pipeline[]>(`/workspaces/${wsId}/pipelines`)
      .then((list) => !cancelled && setPipelines(list))
      .catch(() => !cancelled && setPipelines([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [wsId]);

  const visible = useMemo(
    () =>
      pipelines.filter((p) =>
        pipelineMatchesFilters(p, { q, tags: tagFilters, creators: creatorFilters }),
      ),
    [pipelines, q, tagFilters, creatorFilters],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filterCount = tagFilters.length + creatorFilters.length;
  useEffect(() => { setPage(1); }, [q, tagFilters, creatorFilters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => {
    if (!filterMenu) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterMenu]);

  const canEdit = (p: Pipeline) => !!user && (p.createdBy.id === user.id || current?.role === 'owner');

  async function patchPipeline(p: Pipeline, body: Record<string, unknown>) {
    try {
      const updated = await api<Pipeline>(`/pipelines/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setPipelines((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update pipeline');
      throw err;
    }
  }

  function commitName(p: Pipeline) {
    const patch = pipelineNamePatch(p.name, editing?.val ?? '');
    setEditing(null);
    if (patch) void patchPipeline(p, patch);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/pipelines/${toDelete.id}`, { method: 'DELETE' });
      setPipelines((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete pipeline');
    } finally {
      setDeleting(false);
    }
  }

  function toggleFilterValue<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <div>
      <div className="lin-toolbar">
        <input className="lin-search" placeholder="Search pipelines…" value={q} onChange={(e) => setQ(e.target.value)} />
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
                    setTagFilters([]);
                    setCreatorFilters([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <details className="lin-menu-section">
                <summary className="lin-menu-summary">
                  <span>Tags</span>
                  {tagFilters.length > 0 && <span className="lin-menu-summary-count">{tagFilters.length}</span>}
                </summary>
                {tagVocab.length === 0 && <div className="lin-menu-empty">No pipeline tags</div>}
                {tagVocab.map(([tag, count]) => (
                  <button key={tag} className="lin-menu-item" onClick={() => setTagFilters((list) => toggleFilterValue(list, tag))}>
                    <span className="dot" style={{ background: labelColor(tag, labels) }} />
                    {tag} <span className="lin-menu-count">{count}</span>
                    {tagFilters.includes(tag) && <span className="lin-menu-check">✓</span>}
                  </button>
                ))}
              </details>
              {creatorVocab.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>Created by</span>
                    {creatorFilters.length > 0 && <span className="lin-menu-summary-count">{creatorFilters.length}</span>}
                  </summary>
                  {creatorVocab.map((creator) => (
                    <button key={creator.id} className="lin-menu-item" onClick={() => setCreatorFilters((list) => toggleFilterValue(list, creator.id))}>
                      <span className="dot" style={{ background: labelColor(creator.name, []) }} />
                      {creator.name} <span className="lin-menu-count">{creator.count}</span>
                      {creatorFilters.includes(creator.id) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>
        <button className="lin-add" onClick={() => navigate('/pipelines/new')} title="New pipeline" aria-label="New pipeline">
          <PlusIcon />
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading pipelines…</p>
      ) : pipelines.length === 0 ? (
        <div className="prompt-empty">
          <div className="prompt-empty-art"><PipelinesIcon width={26} height={26} /></div>
          <h3>Build your first pipeline</h3>
          <p>Chain prompts into a flow — each step runs a prompt on a model you pick, feeding its output to the next.</p>
          <button className="btn-primary" onClick={() => navigate('/pipelines/new')}>New pipeline</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">No pipelines match your search.</p>
      ) : (
        <>
        <div className="ptable t-pipeline">
          {pageItems.map((p) => (
            <div
              className="prow"
              key={p.id}
            >
              {editing?.id === p.id ? (
                <input
                  className="lin-title-input"
                  autoFocus
                  value={editing.val}
                  onChange={(e) => setEditing({ id: p.id, val: e.target.value })}
                  onBlur={() => commitName(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitName(p); }
                    else if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <div className="prow-namecell">
                  <button
                    type="button"
                    className="prow-name"
                    title={canEdit(p) ? 'Click to rename' : p.name}
                    onClick={() => (canEdit(p) ? setEditing({ id: p.id, val: p.name }) : navigate(`/pipelines/${p.id}`))}
                  >
                    <span className="nm">{p.name}</span>
                  </button>
                  {p.description && (
                    <span className="prow-sniprow">
                      <span className="snip">{p.description}</span>
                    </span>
                  )}
                </div>
              )}
              <span className="prow-tags">
                {canEdit(p) ? (
                  <LabelPicker
                    value={p.tags}
                    labels={labels}
                    onChange={(tags) => void patchPipeline(p, { tags })}
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
                <span className="badge step-count">{p.steps.length} steps</span>
              </span>
              <span className="prow-facts">
                <span className="prow-date" title={`Created by ${p.createdBy.name}`}>
                  <span className="prow-updated-icon" style={avatarStyle(p.createdBy.name)} aria-hidden="true">
                    {initial(p.createdBy.name)}
                  </span>
                  {fmtDate(p.updatedAt)}
                </span>
              </span>
              <span className="prow-actions">
                <button
                  className="prow-open"
                  onClick={() => navigate(`/pipelines/${p.id}`)}
                  title="Open pipeline"
                  aria-label={`Open ${p.name}`}
                >
                  <PipelinesIcon width={15} height={15} />
                </button>
                {canEdit(p) && (
                  <button
                    className="prow-delete"
                    onClick={() => setToDelete(p)}
                    title="Delete pipeline"
                    aria-label={`Delete ${p.name}`}
                  >
                    <XIcon width={14} height={14} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="pager-info">Page {page} of {totalPages} · {visible.length} total</span>
            <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete pipeline?"
        message={<><strong>{toDelete?.name}</strong> will be removed. Projects using it lose access. This can’t be undone.</>}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
