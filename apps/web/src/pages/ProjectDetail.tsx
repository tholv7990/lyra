import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  ProjectStatus,
  WorkspaceType,
  type Project,
} from '@lyra/shared';
import { api } from '../lib/api';
import { fmtDate, initial, avatarStyle } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { TaskBoard } from '../components/TaskBoard';
import { MoveToTeamModal } from '../components/MoveToTeamModal';
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
  const { current, workspaces } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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

  const [savingMeta, setSavingMeta] = useState(false);

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

  const [showMoveModal, setShowMoveModal] = useState(false);

  // Team workspaces the user belongs to — shown only when current is Personal
  const teamWorkspaces = useMemo(
    () => workspaces.filter((w) => w.type === WorkspaceType.Team),
    [workspaces],
  );

  const canMoveToTeam =
    !!user &&
    !!current &&
    current.type === WorkspaceType.Personal &&
    teamWorkspaces.length > 0 &&
    !!project &&
    project.createdBy.id === user.id;

  // Suppress unused warning for busy (kept for future use / symmetric API)
  void busy;
  void setBusy;

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (!project) return <p className="empty">{error ?? t('projects.notFound')}</p>;

  return (
    <EditorShell wide onBack={() => navigate('/projects')} title={<span className="eshell-spacer" aria-hidden />}>
      <div className="proj-page">
        <div className="proj-head">
          <div className="proj-title-row">
            {canEdit ? (
              <input
                className="proj-title-input"
                value={nameDraft}
                disabled={savingMeta}
                aria-label={t('projects.namePlaceholder')}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { setNameDraft(project.name); e.currentTarget.blur(); }
                }}
              />
            ) : (
              <h1 className="proj-title-static">{project.name}</h1>
            )}
          </div>
          <div className="proj-desc-row">
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
          </div>
          <div className="proj-meta">
            <span className={`badge status-${project.status}`}>{t(PROJECT_STATUS_KEY[project.status])}</span>
            <span className="proj-summary-item">
              <strong>{project.variables.length}</strong>
              {t('projects.variableCount', { count: project.variables.length })}
            </span>
            <span className="proj-summary-user" title={t('projects.createdByName', { name: project.createdBy.name })}>
              <span className="prow-updated-icon" style={avatarStyle(project.createdBy.name)} aria-hidden="true">
                {initial(project.createdBy.name)}
              </span>
            </span>
            <span className="dot">·</span>
            <span>{t('projects.createdByOn', { date: fmtDate(project.createdAt), name: project.createdBy.name })}</span>
            {canMoveToTeam && (
              <>
                <span className="dot">·</span>
                <button
                  type="button"
                  className="txt-btn"
                  onClick={() => setShowMoveModal(true)}
                >
                  {t('projects.moveToTeamAction')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="proj-vars-panel">
          <div className="proj-vars-title">{t('projects.variablesLabel')}</div>
          {project.variables.length > 0 && (
            <div className="proj-vars-view">
              {project.variables.map((v) => (
                <span className="proj-var-chip" key={v.key}>
                  <code>{`{${v.key}}`}</code>
                  <span className="proj-var-val">{v.value || '—'}</span>
                </span>
              ))}
            </div>
          )}
          {project.variables.length === 0 && (
            <p className="proj-vars-empty-view">{t('projects.noVariables')}</p>
          )}
          {canEdit && (
            <Link className="txt-btn proj-vars-edit" to={`/projects/${project.id}/edit`}>
              {t('projects.editVariables')}
            </Link>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <TaskBoard projectId={project.id} canEdit={canEdit} />
      </div>
      {showMoveModal && canMoveToTeam && (
        <MoveToTeamModal
          projectId={project.id}
          teamWorkspaces={teamWorkspaces}
          onClose={() => setShowMoveModal(false)}
        />
      )}
    </EditorShell>
  );
}
