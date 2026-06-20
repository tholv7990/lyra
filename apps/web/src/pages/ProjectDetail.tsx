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
import { useBreadcrumb } from '../layout/breadcrumb';

const PROJECT_STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};

export function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

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

  useEffect(() => {
    if (!project) return;
    setNameDraft(project.name);
    setDescriptionDraft(project.description ?? '');
  }, [project?.id, project?.name, project?.description]);

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

  async function saveProjectMeta(patch: Partial<Pick<Project, 'name' | 'description'>>) {
    if (!id || !project || !canEdit || savingMeta) return;
    setSavingMeta(true);
    setError(null);
    try {
      const updated = await api<Project>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
      setNameDraft(project.name);
      setDescriptionDraft(project.description ?? '');
    } finally {
      setSavingMeta(false);
    }
  }

  const commitName = () => {
    if (!project) return;
    const next = nameDraft.trim();
    if (!next) { setNameDraft(project.name); return; }
    if (next !== project.name) void saveProjectMeta({ name: next });
  };

  const commitDescription = () => {
    if (!project) return;
    if (descriptionDraft !== (project.description ?? '')) void saveProjectMeta({ description: descriptionDraft });
  };

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (!project) return <p className="empty">{error ?? t('projects.notFound')}</p>;

  // Project name lives in the nav header (consistent with the other detail/editor
  // pages), inline-editable for editors.
  const headerTitle = canEdit ? (
    <input
      className="eshell-name"
      value={nameDraft}
      disabled={savingMeta}
      aria-label={t('projects.namePlaceholder')}
      placeholder={t('projects.namePlaceholder')}
      onChange={(e) => setNameDraft(e.target.value)}
      onBlur={commitName}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setNameDraft(project.name); e.currentTarget.blur(); }
      }}
    />
  ) : (
    <h2 className="eshell-name">{project.name}</h2>
  );

  return (
    <EditorShell wide onBack={() => navigate('/projects')} title={headerTitle}>
      <div className="proj-page">
        {error && <p className="error">{error}</p>}

        {/* Description */}
        {canEdit ? (
          <textarea
            className="proj-desc-input"
            value={descriptionDraft}
            disabled={savingMeta}
            rows={2}
            placeholder={t('projects.descriptionPlaceholder')}
            aria-label={t('projects.descriptionLabel')}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            onBlur={commitDescription}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDescriptionDraft(project.description ?? ''); e.currentTarget.blur(); }
            }}
          />
        ) : (
          <p className="proj-product">{project.description || t('projects.noDescription')}</p>
        )}

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
            <Link className="txt-btn" to={`/projects/${project.id}/edit`}>
              {t('projects.editVariables')}
            </Link>
          )}
        </div>

        {/* Tasks */}
        <TaskList projectId={project.id} canEdit={canEdit} />
      </div>
    </EditorShell>
  );
}
