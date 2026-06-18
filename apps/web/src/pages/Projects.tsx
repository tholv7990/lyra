import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { canEditProject, labelColor, ProjectStatus, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProjectsIcon, PlusIcon } from '../layout/icons';

const STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: '#d4a72c',
  [ProjectStatus.Public]: '#2da44e',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  function toggleFilterValue<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <div>
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
        <div className="prompt-empty">
          <div className="prompt-empty-art"><ProjectsIcon width={26} height={26} /></div>
          <h3>{t('projects.emptyTitle')}</h3>
          <p>{t('projects.emptyBody')}</p>
          <button className="btn-primary" onClick={() => navigate('/projects/new')}>{t('projects.newProject')}</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">{t('projects.noMatch')}</p>
      ) : (
        <>
        <div className="ptable t-project">
          {pageItems.map((p) => (
            <div
              className="prow"
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${p.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${p.id}`); }}
            >
              <div className="prow-name">
                <span className="nm">{p.name}</span>
              </div>
              <span>
                <span className={`badge status-${p.status}`}>{t(STATUS_KEY[p.status])}</span>
              </span>
              <span className="prow-date" style={{ whiteSpace: 'normal' }}>{p.description || '—'}</span>
              <span className="prow-date">{fmtDate(p.updatedAt)}</span>
              <span className="prow-actions" onClick={(e) => e.stopPropagation()}>
                <Link className="txt-btn" to={`/projects/${p.id}`}>{t('common.open')}</Link>
                {canEdit(p) && <Link className="txt-btn" to={`/projects/${p.id}/edit`}>{t('common.edit')}</Link>}
                {canEdit(p) && <button className="txt-btn danger" onClick={() => setToDelete(p)}>{t('common.delete')}</button>}
              </span>
            </div>
          ))}
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
