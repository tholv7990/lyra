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
import { EditorShell } from '../components/EditorShell';
import { TaskList } from '../components/TaskList';
import { StatusPill } from '../components/StatusPill';
import { useLabels } from '../lib/useLabels';
import { PencilIcon, PlusIcon, PublishIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './projects.css';

// The project detail (design): a context strip (status · creator · description ·
// variables) over a horizontal task board. The name lives in the shell header;
// editing the project happens on the editor (own ✓/✕ flow).
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
    <EditorShell
      wide
      crumb={{ label: t('nav.projects'), to: '/projects' }}
      onClose={() => navigate('/projects')}
      title={<h2 className="eshell-name">{project.name}</h2>}
    >
      <div className="pd">
        {error && <p className="error">{error}</p>}

        <div className="pd-context">
          <div className="pd-meta">
            <span className="pd-by" title={t('projects.createdByName', { name: project.createdBy.name })}>
              <Avatar name={project.createdBy.name} size={20} />
              {project.createdBy.name} · {fmtDate(project.createdAt)}
            </span>
            <span className="pd-meta-right">
              <StatusPill status={project.status} />
              {canEdit && (
                <button
                  type="button"
                  className="icon-btn pd-edit"
                  onClick={() => navigate(editUrl)}
                  title={t('projects.editProject')}
                  aria-label={t('projects.editProject')}
                >
                  <PencilIcon width={15} height={15} />
                </button>
              )}
            </span>
          </div>

          <p className="pd-desc">{project.description || t('projects.noDescription')}</p>

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

        {/* Channels & publishing — the project posts to its own connected channels. */}
        <section className="pd-channels">
          <div className="pd-channels-head">
            <span className="pd-section-label">{t('projects.channelsLabel')}</span>
            <button
              type="button"
              className="btn-primary btn-inline btn-sm pd-act"
              onClick={() => navigate(`/publish?project=${project.id}`)}
              title={t('projects.publish')}
            >
              <PublishIcon width={14} height={14} /> <span className="pd-act-label">{t('projects.publish')}</span>
            </button>
          </div>
          {channels.length === 0 ? (
            <p className="pd-channels-empty">
              {t('projects.noChannelsSet')}{' '}
              {canEdit && (
                <button type="button" className="pd-setlink" onClick={() => navigate(editUrl)}>
                  {t('projects.setChannels')}
                </button>
              )}
            </p>
          ) : (
            <div className="pd-channel-chips">
              {channels.map((c) => (
                <span className="pd-channel-chip" key={c.id}>
                  <span className="pd-channel-ico" style={{ background: platformColor(c.platform) }}>{platformGlyph(c.platform)}</span>
                  <span className="pd-channel-name">{c.displayName}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Post history — what this project has published, newest first. */}
        <section className="pd-posts">
          <div className="pd-channels-head">
            <span className="pd-section-label">{t('projects.postsLabel')}</span>
          </div>
          {posts.length === 0 ? (
            <p className="pd-channels-empty">{t('projects.noPosts')}</p>
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

        <section className="pd-tasks">
          <div className="pd-channels-head">
            <span className="pd-section-label">{t('projects.tasksLabel')}</span>
            {canEdit && (
              <button
                type="button"
                className="btn-primary btn-inline btn-sm pd-act"
                onClick={() => setAddTick((n) => n + 1)}
                title={t('projects.newTask')}
              >
                <PlusIcon width={14} height={14} /> <span className="pd-act-label">{t('projects.newTask')}</span>
              </button>
            )}
          </div>
          <TaskList projectId={project.id} projectName={project.name} canEdit={canEdit} labels={labels} openAddTick={addTick} />
        </section>
      </div>
    </EditorShell>
  );
}
