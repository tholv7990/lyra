import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { canEditProject, type Channel, type Project, type PublishedPost } from '@lyra/shared';
import { api } from '../lib/api';
import { channelsApi } from '../lib/channels';
import { postsApi } from '../lib/posts';
import { platformColor, platformGlyph } from '../lib/platform';
import { fmtDate } from '../lib/format';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { TaskList } from '../components/TaskList';
import { StatusPill } from '../components/StatusPill';
import { useLabels } from '../lib/useLabels';
import { PencilIcon, PlusIcon, PublishIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './projects.css';

// The project detail page (design): a full-page layout with a project header
// strip (title · author · date · status · edit) and a scrollable body containing
// Channels, Posts, and the horizontal Task kanban board (TaskList).
// No EditorShell wrapper — the page owns its own header area.
export function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [pool, setPool] = useState<Channel[]>([]); // connected-channel pool (to resolve project.channels)
  const [posts, setPosts] = useState<PublishedPost[]>([]); // post history for this project
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addTick, setAddTick] = useState(0); // header "New task" → open New column composer

  useBreadcrumb(project?.name ?? null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setProject(await api<Project>(`/projects/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  // The connected-channel pool, to render the project's selected channels by name/icon.
  useEffect(() => {
    const ws = current?.id;
    if (!ws) return;
    channelsApi.list(ws).then(setPool).catch(() => setPool([]));
  }, [current?.id]);

  // This project's published-post history.
  useEffect(() => {
    if (!id) return;
    postsApi.list(id).then(setPosts).catch(() => setPosts([]));
  }, [id]);

  const canEdit = useMemo(
    () =>
      !!user && !!current && !!project &&
      project.workspaceId === current.id &&
      canEditProject(
        { createdBy: project.createdBy.id },
        { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
      ),
    [user, current, project],
  );

  const { labels } = useLabels(project?.workspaceId);

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (!project) return <p className="empty">{error ?? t('projects.notFound')}</p>;

  const editUrl = `/projects/${project.id}/edit`;
  // The project's selected channels, resolved to live pool entries (drops any that
  // were disconnected since they were picked).
  const channels = project.channels?.length ? pool.filter((c) => project.channels.includes(c.id)) : [];

  return (
    <div className="pd-page">
      {error && <p className="error">{error}</p>}

      {/* Project header strip: title + close / meta / description */}
      <div className="pd-header">
        <div className="pd-header-top">
          <h1 className="pd-title">{project.name}</h1>
          <button
            type="button"
            className="icon-btn pd-close"
            onClick={() => navigate('/projects')}
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            {/* X icon */}
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <div className="pd-header-meta">
          <span className="pd-by">
            <Avatar name={project.createdBy.name} size={22} />
            {project.createdBy.name} · {fmtDate(project.createdAt)}
          </span>
          <div className="pd-header-actions">
            <StatusPill status={project.status} />
            {canEdit && (
              <button
                type="button"
                className="btn-ghost btn-inline btn-sm"
                onClick={() => navigate(editUrl)}
                title={t('projects.editProject')}
              >
                <PencilIcon width={13} height={13} />
                <span>{t('projects.editProject')}</span>
              </button>
            )}
          </div>
        </div>
        {project.description && (
          <p className="pd-desc">{project.description}</p>
        )}
        {project.variables.length > 0 && (
          <div className="pd-vars">
            <span className="pd-vars-label">{t('projects.variablesLabel')}</span>
            {project.variables.map((v) => (
              <span className="pd-var" key={v.key}>
                <span className="pd-var-k">{v.key}</span>
                <span className="pd-var-eq">=</span>
                <span className="pd-var-v">{v.value || '—'}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable body: channels · posts · tasks kanban */}
      <div className="pd-body">

        {/* Channels & publishing */}
        <section className="pd-section">
          <div className="pd-section-head">
            <span className="pd-section-label">
              {t('projects.channelsLabel')}
              <span className="pd-count">{channels.length}</span>
            </span>
            <button
              type="button"
              className="btn-primary btn-inline btn-sm pd-act"
              onClick={() => navigate(`/publish?project=${project.id}`)}
              title={t('projects.publish')}
            >
              <PublishIcon width={14} height={14} />
              <span className="pd-act-label">{t('projects.publish')}</span>
            </button>
          </div>
          {channels.length === 0 ? (
            <div className="pd-empty-card pd-empty-dashed">
              <span className="pd-empty-ico">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.6 9.4 9.4 6.6M7 4.6l.9-.9a2.5 2.5 0 0 1 3.5 3.5l-.9.9M9 11.4l-.9.9a2.5 2.5 0 0 1-3.5-3.5l.9-.9" /></svg>
              </span>
              <div className="pd-empty-body">
                <div className="pd-empty-title">{t('projects.noChannelsSet')}</div>
                <div className="pd-empty-sub">{t('projects.channelsHelp')}</div>
              </div>
              {canEdit && (
                <button type="button" className="btn-ghost btn-inline btn-sm" onClick={() => navigate(editUrl)}>
                  <PlusIcon width={13} height={13} />
                  {t('projects.setChannels')}
                </button>
              )}
            </div>
          ) : (
            <div className="pd-channel-row">
              <span className="pd-channel-lbl">{t('projects.publish')}</span>
              <div className="pd-channel-chips">
                {channels.map((c) => (
                  <span className="pd-channel-chip" key={c.id}>
                    <span className="pd-channel-ico" style={{ background: platformColor(c.platform) }}>{platformGlyph(c.platform)}</span>
                    <span className="pd-channel-name">{c.displayName}</span>
                  </span>
                ))}
              </div>
              {canEdit && (
                <button type="button" className="pd-setlink" onClick={() => navigate(editUrl)}>
                  {t('projects.manageChannels')}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Post history */}
        <section className="pd-section">
          <div className="pd-section-head">
            <span className="pd-section-label">{t('projects.postsLabel')}</span>
          </div>
          {posts.length === 0 ? (
            <div className="pd-empty-card pd-empty-dashed pd-empty-center">
              <span className="pd-empty-ico pd-empty-ico--neutral">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2.4" y="3" width="11.2" height="10" rx="1.6" /><path d="M2.4 6.2h11.2M5.2 9h5.6M5.2 11h3.4" /></svg>
              </span>
              <div className="pd-empty-title">{t('projects.noPosts')}</div>
              <div className="pd-empty-sub">{t('projects.channelsHelp')}</div>
            </div>
          ) : (
            <ul className="pd-post-list">
              {posts.slice(0, 8).map((post) => (
                <li className="pd-post" key={post.id}>
                  <span className={`pd-post-status pd-post-${post.status}`} title={post.status} />
                  <span className="pd-post-cap" title={post.caption}>{post.caption || t('projects.noCaption')}</span>
                  <span className="pd-post-outlets">
                    {post.targets.map((tg, i) =>
                      tg.url ? (
                        <a key={i} href={tg.url} target="_blank" rel="noreferrer" className="pd-post-ico" title={`${tg.platform} ↗`} style={{ background: platformColor(tg.platform) }}>
                          {platformGlyph(tg.platform)}
                        </a>
                      ) : (
                        <span key={i} className="pd-post-ico" title={`${tg.platform} · ${tg.status}`} style={{ background: platformColor(tg.platform), opacity: tg.status === 'ok' ? 1 : 0.4 }}>
                          {platformGlyph(tg.platform)}
                        </span>
                      ),
                    )}
                  </span>
                  <span className="pd-post-date">{fmtDate(post.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tasks */}
        <section className="pd-section pd-tasks-section">
          <div className="pd-section-head">
            <span className="pd-section-label">{t('projects.tabTasks')}</span>
            {canEdit && (
              <button
                type="button"
                className="btn-ghost btn-inline btn-sm pd-act"
                onClick={() => setAddTick((n) => n + 1)}
                title={t('projects.newTask')}
              >
                <PlusIcon width={14} height={14} />
                <span className="pd-act-label">{t('projects.newTask')}</span>
              </button>
            )}
          </div>
          <TaskList
            projectId={project.id}
            projectName={project.name}
            canEdit={canEdit}
            labels={labels}
            openAddTick={addTick}
          />
        </section>

      </div>
    </div>
  );
}
