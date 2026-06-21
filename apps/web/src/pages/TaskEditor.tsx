import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { canEditProject, type Project, type Task } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

// Small editor for a task's name + description — mirrors the project editor's
// ✓/✕ flow. Status, assignee, and pipelines are managed inline on the task detail.
export function TaskEditor() {
  const { t } = useTranslation();
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('…');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useBreadcrumb(name.trim() || '…', { label: projectName, to: `/projects/${projectId}` });

  useEffect(() => {
    if (!projectId || !taskId) return;
    setLoading(true);
    Promise.all([
      api<Project>(`/projects/${projectId}`),
      api<Task>(`/projects/${projectId}/tasks/${taskId}`),
    ])
      .then(([p, task]) => {
        const canEdit =
          !!user && !!current &&
          canEditProject(
            { createdBy: p.createdBy.id },
            { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
          );
        if (!canEdit) { setDenied(true); return; }
        setProjectName(p.name);
        setName(task.name);
        setDescription(task.description ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('tasks.loadFailed')))
      .finally(() => setLoading(false));
  }, [projectId, taskId, user, current]);

  const cancelTo = `/projects/${projectId}/tasks/${taskId}`;

  async function save() {
    if (!projectId || !taskId || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api<Task>(`/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), description }),
      });
      navigate(cancelTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (denied) return <p className="empty">{t('projects.editDenied')}</p>;

  return (
    <EditorShell
      crumb={{ label: projectName, to: `/projects/${projectId}` }}
      onClose={() => navigate(cancelTo)}
      title={
        <input
          className="eshell-name"
          placeholder={t('tasks.namePlaceholder')}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
        />
      }
      actions={
        <button
          type="button"
          className="icon-btn-success"
          title={t('common.save')}
          aria-label={t('common.save')}
          disabled={busy || !name.trim()}
          onClick={() => void save()}
        >
          <CheckIcon width={16} height={16} />
        </button>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="project-edit">
        <section className="project-edit-section">
          <div className="project-edit-section-head">
            <span className="pf-label">{t('projects.descriptionLabel')}</span>
          </div>
          <div className="project-field project-field-stack">
            <textarea
              className="project-input project-textarea"
              placeholder={t('tasks.descriptionPlaceholder')}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </section>
      </div>
    </EditorShell>
  );
}
