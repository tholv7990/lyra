import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { canEditProject, labelColor, ProjectStatus, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { fmtDate, initials } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { TaskList } from '../components/TaskList';
import { useLabels } from '../lib/useLabels';
import { PencilIcon, PlusIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './projects.css';

const PROJECT_STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};

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

  return (
    <EditorShell
      wide
      onBack={() => navigate('/projects')}
      title={<h2 className="eshell-name">{project.name}</h2>}
      actions={
        canEdit ? (
          <>
            <button type="button" className="btn-ghost btn-inline btn-sm" onClick={() => navigate(editUrl)}>
              <PencilIcon width={14} height={14} /> {t('projects.editProject')}
            </button>
            <button type="button" className="btn-primary btn-inline btn-sm" onClick={() => setAddTick((n) => n + 1)}>
              <PlusIcon width={14} height={14} /> {t('projects.newTask')}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="pd">
        {error && <p className="error">{error}</p>}

        <div className="pd-context">
          <div className="pd-meta">
            <span className={`badge status-${project.status}`}>{t(PROJECT_STATUS_KEY[project.status])}</span>
            <span className="pd-by" title={t('projects.createdByName', { name: project.createdBy.name })}>
              <span className="pd-by-av" style={{ background: labelColor(project.createdBy.name, []) }} aria-hidden>
                {initials(project.createdBy.name)}
              </span>
              {project.createdBy.name} · {fmtDate(project.createdAt)}
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

        <TaskList projectId={project.id} canEdit={canEdit} labels={labels} openAddTick={addTick} />
      </div>
    </EditorShell>
  );
}
