import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { canEditProject, labelColor, ProjectShare, ProjectStatus, type Channel, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { channelsApi } from '../lib/channels';
import { platformColor, platformGlyph } from '../lib/platform';
import { fmtDate } from '../lib/format';
import { Avatar } from '../components/Avatar';
import { STATUS_COLOR, STATUS_LABEL_KEY } from '../lib/constants';
import { toggleInList } from '../lib/array';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { canCreateIn } from '../lib/perms';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { StatusPill } from '../components/StatusPill';
import { FilterPopover } from '../components/FilterPopover';
import { Pager } from '../components/Pager';
import { PlusIcon, ProjectsIcon, SearchGlyph, TrashIcon } from '../layout/icons';
import './marketplace.css';
import './projects.css';

const PAGE_SIZE = 9;

function GlobeGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="5.4" />
      <path d="M2.6 8h10.8M8 2.6c1.5 1.6 1.5 9.2 0 10.8M8 2.6C6.5 4.2 6.5 11.8 8 13.4" />
    </svg>
  );
}

function PeopleGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="2.2" />
      <path d="M2.6 12.4a3.4 3.4 0 0 1 6.8 0M10.4 4.2a2.2 2.2 0 0 1 0 3.6M11 12.4a3.4 3.4 0 0 0-1.6-2.9" />
    </svg>
  );
}

// The project's outlets at a glance — one square per distinct platform it posts to.
function ChannelDots({ platforms }: { platforms: string[] }) {
  if (!platforms.length) return null;
  return (
    <div className="pr-channels" title={platforms.join(' · ')}>
      {platforms.map((p) => (
        <span key={p} className="pr-channel-ico" style={{ background: platformColor(p) }}>{platformGlyph(p)}</span>
      ))}
    </div>
  );
}

export function Projects() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const mayCreate = canCreateIn(current);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pool, setPool] = useState<Channel[]>([]); // connected-channel pool → resolve project.channels to platforms
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilters, setStatusFilters] = useState<ProjectStatus[]>([]);
  const [creatorFilters, setCreatorFilters] = useState<string[]>([]);
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

  // Channel pool → map id→platform so each card can show its outlets.
  useEffect(() => {
    if (!wsId) return;
    channelsApi.list(wsId).then(setPool).catch(() => setPool([]));
  }, [wsId]);
  const platformById = useMemo(() => new Map(pool.map((c) => [c.id, c.platform])), [pool]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (query && !(p.name + ' ' + p.description).toLowerCase().includes(query)) return false;
      if (statusFilters.length && !statusFilters.includes(p.status)) return false;
      if (creatorFilters.length && !creatorFilters.includes(p.createdBy.id)) return false;
      return true;
    });
  }, [projects, q, statusFilters, creatorFilters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filterCount = statusFilters.length + creatorFilters.length;
  const rangeStart = visible.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, visible.length);
  useEffect(() => { setPage(1); }, [q, statusFilters, creatorFilters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

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

  return (
    <div>
      <header className="mkt-head">
        <h1>{t('nav.projects')}</h1>
        <p>{t('projects.subtitle')}</p>
      </header>

      <div className="mkt-toolbar">
        <label className="mkt-search">
          <SearchGlyph />
          <input
            value={q}
            placeholder={t('projects.searchPlaceholder')}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('projects.searchPlaceholder')}
          />
        </label>
        <FilterPopover
          label={t('projects.filterLabel')}
          count={filterCount}
          onClear={() => { setStatusFilters([]); setCreatorFilters([]); }}
        >
              <div className="lin-menu-label">{t('projects.status')}</div>
              {Object.values(ProjectStatus).map((status) => (
                <button key={status} className="lin-menu-item" onClick={() => setStatusFilters((list) => toggleInList(list, status))}>
                  <span className="dot" style={{ background: STATUS_COLOR[status] }} />
                  {t(STATUS_LABEL_KEY[status])}
                  {statusFilters.includes(status) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
              {creatorVocab.length > 0 && (
                <details className="lin-menu-section">
                  <summary className="lin-menu-summary">
                    <span>{t('projects.createdBy')}</span>
                    {creatorFilters.length > 0 && <span className="lin-menu-summary-count">{creatorFilters.length}</span>}
                  </summary>
                  {creatorVocab.map((c) => (
                    <button key={c.id} className="lin-menu-item" onClick={() => setCreatorFilters((list) => toggleInList(list, c.id))}>
                      <span className="dot" style={{ background: labelColor(c.name, []) }} />
                      {c.name} <span className="lin-menu-count">{c.count}</span>
                      {creatorFilters.includes(c.id) && <span className="lin-menu-check">✓</span>}
                    </button>
                  ))}
                </details>
              )}
        </FilterPopover>
        {mayCreate && (
          <button className="btn-primary btn-inline btn-lg pr-new" onClick={() => navigate('/projects/new')}>
            <PlusIcon width={15} height={15} />
            {t('projects.newProject')}
          </button>
        )}
      </div>

      {!loading && visible.length > 0 && (
        <div className="mkt-meta">
          <span className="mkt-meta-count">
            {t('projects.showingRange', { start: rangeStart, end: rangeEnd, total: visible.length })}
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">{t('projects.loadingProjects')}</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<ProjectsIcon width={26} height={26} />}
          title={t('projects.emptyTitle')}
          body={t('projects.emptyBody')}
          cta={mayCreate ? { label: t('projects.newProject'), onClick: () => navigate('/projects/new') } : undefined}
        />
      ) : visible.length === 0 ? (
        <p className="empty">{t('projects.noMatch')}</p>
      ) : (
        <>
          <div className="mkt-grid pr-grid">
            {pageItems.map((p) => (
              <article className="mkt-card pr-card" key={p.id}>
                <div className="pr-card-head">
                  <button type="button" className="mkt-card-title" title={p.name} onClick={() => navigate(`/projects/${p.id}`)}>
                    {p.name}
                  </button>
                  <StatusPill status={p.status} />
                </div>

                <p className="pr-card-desc" onClick={() => navigate(`/projects/${p.id}`)}>
                  {p.description || t('projects.noDescription')}
                </p>

                {p.variables.length > 0 && (
                  <div className="pr-vars">
                    {p.variables.slice(0, 4).map((v) => (
                      <span className="pr-var" key={v.key}>
                        <span className="pr-var-k">{v.key}</span>
                        <span className="pr-var-v">{v.value}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="pr-stats">
                  {p.taskCount !== undefined && (
                    <span className="pr-stat">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="2.6" y="2.6" width="4.4" height="4.4" rx="1" />
                        <rect x="9" y="2.6" width="4.4" height="4.4" rx="1" />
                        <rect x="2.6" y="9" width="4.4" height="4.4" rx="1" />
                        <rect x="9" y="9" width="4.4" height="4.4" rx="1" />
                      </svg>
                      {t('projects.tasksCount', { count: p.taskCount })}
                    </span>
                  )}
                  <span className="pr-stat">
                    {p.shared === ProjectShare.All ? <GlobeGlyph /> : <PeopleGlyph />}
                    {p.shared === ProjectShare.All ? t('projects.sharedAll') : t('projects.sharedPeople')}
                  </span>
                  <ChannelDots
                    platforms={[...new Set((p.channels ?? []).map((id) => platformById.get(id)).filter((x): x is string => !!x))]}
                  />
                </div>

                <div className="mkt-card-foot pr-foot">
                  <span className="mkt-by" title={t('projects.createdByName', { name: p.createdBy.name })}>
                    <Avatar name={p.createdBy.name} size={20} />
                    <span className="mkt-by-name">{p.createdBy.name} · {fmtDate(p.updatedAt)}</span>
                  </span>
                  <div className="mkt-card-actions">
                    {canEdit(p) && (
                      <IconButton
                        boxed
                        size="sm"
                        variant="danger"
                        icon={<TrashIcon width={15} height={15} />}
                        label={`${t('common.delete')} ${p.name}`}
                        onClick={() => setToDelete(p)}
                      />
                    )}
                    <button type="button" className="pr-open" onClick={() => navigate(`/projects/${p.id}`)}>
                      {t('projects.open')}
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 3.5 9.5 8 5 12.5" /></svg>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
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
