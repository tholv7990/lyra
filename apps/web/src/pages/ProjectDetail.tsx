import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { canEditProject, ProjectStatus, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { fmtDate, initial, avatarStyle } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { TaskList } from '../components/TaskList';
import { useLabels } from '../lib/useLabels';
import { PencilIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

const PROJECT_STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};

// The project detail is a read view (Linear-style): name in the nav, then a
// readable description, info, variables, and the task list. Editing the project
// (name / description / variables / status) happens on the project editor, which
// owns the explicit ✓/✕ save flow — the detail page never edits in place.
export function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumb(project?.name ?? null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await api<Project>(`/projects/${id}`);
      setProject(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  const canEdit = useMemo(
    () =>
      !!user &&
      !!current &&
      !!project &&
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
  const goEdit = () => navigate(editUrl);

  return (
    <EditorShell
      wide
      onBack={() => navigate('/projects')}
      title={<h2 className="eshell-name">{project.name}</h2>}
      actions={
        canEdit ? (
          <button type="button" className="icon-btn" aria-label={t('common.edit')} title={t('common.edit')} onClick={goEdit}>
            <PencilIcon width={16} height={16} />
          </button>
        ) : undefined
      }
    >
      <div className="proj-page">
        {error && <p className="error">{error}</p>}

        {/* Desktop edit entry (the nav header is hidden on desktop). */}
        {canEdit && (
          <div className="proj-toolbar">
            <button type="button" className="btn-ghost btn-inline" onClick={goEdit}>
              <PencilIcon width={14} height={14} /> {t('common.edit')}
            </button>
          </div>
        )}

        {/* Description */}
        <p className="proj-product">{project.description || t('projects.noDescription')}</p>

        {/* Info — status · creator · date */}
        <div className="proj-meta">
          <span className={`badge status-${project.status}`}>{t(PROJECT_STATUS_KEY[project.status])}</span>
          <span className="proj-summary-user" title={t('projects.createdByName', { name: project.createdBy.name })}>
            <span className="prow-updated-icon" style={avatarStyle(project.createdBy.name)} aria-hidden="true">
              {initial(project.createdBy.name)}
            </span>
            {project.createdBy.name}
          </span>
          <span className="dot">·</span>
          <span>{fmtDate(project.createdAt)}</span>
        </div>

        {/* Variables */}
        <div className="proj-vars">
          <span className="proj-vars-k">{t('projects.variablesLabel')}</span>
          {project.variables.length > 0 ? (
            <div className="proj-vars-view">
              {project.variables.map((v) => (
                <span className="proj-var-chip" key={v.key}>
                  <code>{`{${v.key}}`}</code>
                  <span className="proj-var-val">{v.value || '—'}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="proj-vars-none">{t('projects.noVariables')}</span>
          )}
          {canEdit && (
            <Link className="txt-btn" to={editUrl}>
              {t('projects.editVariables')}
            </Link>
          )}
        </div>

        {/* Tasks */}
        <TaskList projectId={project.id} canEdit={canEdit} labels={labels} />
      </div>
    </EditorShell>
  );
}
