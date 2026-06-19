import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { canEditProject, labelColor, ProjectStatus, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ProjectsIcon, PlusIcon, XIcon } from '../layout/icons';

const STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'var(--warning)',
  [ProjectStatus.Public]: 'var(--success)',
};

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

const PAGE_SIZE = 10;

export function Projects() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilters, setStatusFilters] = useState<ProjectStatus[]>([]);
  const [creatorFilters, setCreatorFilters] = useState<string[]>([]);
  const [filterMenu, setFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const wsId = current?.id;

  const creatorVocab = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const p of projects) {
      const existing = byId.get(p.createdBy.id);
      if (existing) existing.count += 1;
      else byId.set(p.createdBy.id, { ...p.createdBy, count: 1 });
    }
    return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [projects]);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Project[]>(`/workspaces/${wsId}/projects`)
      .then((list) => !cancelled && setProjects(list))
      .catch(() => !cancelled && setProjects([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [wsId]);

  const visible = useMemo(
    () => {
      const query = q.trim().toLowerCase();
      return projects.filter((p) => {
        if (query && !p.name.toLowerCase().includes(query)) return false;
        if (statusFilters.length && !statusFilters.includes(p.status)) return false;
        if (creatorFilters.length && !creatorFilters.includes(p.createdBy.id)) return false;
        return true;
      });
    },
    [projects, q, statusFilters, creatorFilters],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filterCount = statusFilters.length + creatorFilters.length;
  useEffect(() => { setPage(1); }, [q, statusFilters, creatorFilters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => {
    if (!filterMenu) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterMenu]);

  function canEdit(p: Project) {
    if (!current || !user) return false;
    return canEditProject(
      { createdBy: p.createdBy.id },
      { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
    );
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/projects/${toDelete.id}`, { method: 'DELETE' });
      setProjects((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  function draftFor(p: Project) {
    return drafts[p.id] ?? { name: p.name, description: p.description ?? '' };
  }

  function setDraft(p: Project, patch: Partial<{ name: string; description: string }>) {
    setDrafts((current) => ({
      ...current,
      [p.id]: { ...draftFor(p), ...patch },
    }));
  }

  async function saveInline(p: Project) {
    if (!canEdit(p) || savingId === p.id) return;
    const draft = draftFor(p);
    const name = draft.name.trim();
    const description = draft.description;
    if (!name) {
      setDrafts((current) => ({ ...current, [p.id]: { name: p.name, description: p.description ?? '' } }));
      return;
    }
    if (name === p.name && description === (p.description ?? '')) return;
    setSavingId(p.id);
    setError(null);
    try {
      const updated = await api<Project>(`/projects/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      });
      setProjects((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((current) => ({ ...current, [updated.id]: { name: updated.name, description: updated.description ?? '' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
      setDrafts((current) => ({ ...current, [p.id]: { name: p.name, description: p.description ?? '' } }));
    } finally {
      setSavingId(null);
    }
  }

  function toggleFilterValue<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <div>
      <h1 className="sr-only">{t('nav.projects')}</h1>
      <div className="lin-toolbar">
        <input className="lin-search" placeholder={t('projects.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="lin-filter" ref={filterRef}>
          <button
            className={`lin-filter-btn ${filterCount > 0 || filterMenu ? 'active' : ''}`}
            onClick={() => setFilterMenu((s) => !s)}
          >
            {t('projects.filter')}{filterCount > 0 && <> <span className="lin-filter-count">{filterCount}</span></>}
          </button>
          {filterMenu && (
            <div className="lin-menu">
              <div className="lin-menu-actions">
                <button
                  type="button"
                  className="lin-menu-clear"
                  disabled={filterCount === 0}
                  onClick={() => {
                    setStatusFilters([]);
                    setCreatorFilters([]);
                  }}
                >
                  {t('common.clear')}
                </button>
              </div>
              <div className="lin-menu-label">{t('projects.status')}</div>
              {Object.values(ProjectStatus).map((status) => (
                <button key={status} className="lin-menu-item" onClick={() => setStatusFilters((list) => toggleFilterValue(list, status))}>
                  <span className="dot" style={{ background: STATUS_COLOR[status] }} />
                  {t(STATUS_KEY[status])}
                  {statusFilters.includes(status) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              {creatorVocab.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('projects.createdBy')}</span>
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
        <button className="lin-add" onClick={() => navigate('/projects/new')} title={t('projects.newProject')} aria-label={t('projects.newProject')}>
          <PlusIcon />
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">{t('projects.loadingProjects')}</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<ProjectsIcon width={26} height={26} />}
          title={t('projects.emptyTitle')}
          body={t('projects.emptyBody')}
          cta={{ label: t('projects.newProject'), onClick: () => navigate('/projects/new') }}
        />
      ) : visible.length === 0 ? (
        <p className="empty">{t('projects.noMatch')}</p>
      ) : (
        <>
        <div className="ptable t-project">
          {pageItems.map((p) => {
            const editable = canEdit(p);
            const draft = draftFor(p);
            return (
            <div
              className="prow"
              key={p.id}
            >
              <div className="prow-namecell">
                {editable ? (
                  <input
                    className="prow-name prow-title-input"
                    value={draft.name}
                    disabled={savingId === p.id}
                    aria-label={t('projects.namePlaceholder')}
                    onChange={(e) => setDraft(p, { name: e.target.value })}
                    onBlur={() => void saveInline(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                      if (e.key === 'Escape') {
                        setDrafts((current) => ({ ...current, [p.id]: { name: p.name, description: p.description ?? '' } }));
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="prow-name"
                    onClick={() => navigate(`/projects/${p.id}`)}
                    title={p.name}
                  >
                    <span className="nm">{p.name}</span>
                  </button>
                )}
                <span className="prow-sniprow">
                  {editable ? (
                    <textarea
                      className="prow-desc-input"
                      value={draft.description}
                      disabled={savingId === p.id}
                      rows={2}
                      placeholder={t('projects.descriptionPlaceholder')}
                      aria-label={t('projects.descriptionLabel')}
                      onChange={(e) => setDraft(p, { description: e.target.value })}
                      onBlur={() => void saveInline(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setDrafts((current) => ({ ...current, [p.id]: { name: p.name, description: p.description ?? '' } }));
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <span className="snip">{p.description || t('projects.noDescription')}</span>
                  )}
                </span>
              </div>
              <span className="prow-status">
                <span className={`badge status-${p.status}`}>{t(STATUS_KEY[p.status])}</span>
              </span>
              <span className="prow-facts">
                <span className="prow-date" title={t('projects.createdByName', { name: p.createdBy.name })}>
                  <span className="prow-updated-icon" style={avatarStyle(p.createdBy.name)} aria-hidden="true">
                    {initial(p.createdBy.name)}
                  </span>
                  {fmtDate(p.updatedAt)}
                </span>
              </span>
              <span className="prow-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="prow-open"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  title={t('common.open')}
                  aria-label={`${t('common.open')} ${p.name}`}
                >
                  <ProjectsIcon width={15} height={15} />
                </button>
                {canEdit(p) && (
                  <button
                    type="button"
                    className="prow-delete"
                    onClick={() => setToDelete(p)}
                    title={t('common.delete')}
                    aria-label={`${t('common.delete')} ${p.name}`}
                  >
                    <XIcon width={14} height={14} />
                  </button>
                )}
              </span>
            </div>
          );
          })}
        </div>
        {totalPages > 1 && (
          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('projects.prev')}</button>
            <span className="pager-info">{t('projects.pagerInfo', { page, totalPages, total: visible.length })}</span>
            <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('projects.nextPage')}</button>
          </div>
        )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('projects.deleteTitle')}
        message={<><strong>{toDelete?.name}</strong>{t('projects.deleteMessage')}</>}
        confirmLabel={t('common.delete')}
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
