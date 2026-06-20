import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  ProjectStatus,
  type Project,
  type ProjectVariable,
} from '@lyra/shared';
import { api } from '../lib/api';
import { STATUS_COLOR } from '../lib/constants';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon, XIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

const STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};
// Shown beneath the toggle; reflects what the current status actually does.
// (Member-level sharing is deferred — a public project is visible to everyone.)
const STATUS_HELP_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusHelpDraft',
  [ProjectStatus.Public]: 'projects.statusHelpPublic',
};

interface Form {
  name: string;
  description: string;
  variables: ProjectVariable[];
  status: ProjectStatus;
}

const empty: Form = {
  name: '',
  description: '',
  variables: [],
  status: ProjectStatus.Draft,
};

export function ProjectEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [form, setForm] = useState<Form>(empty);
  useBreadcrumb(isEdit ? form.name.trim() || '…' : t('projects.breadcrumbNew'));
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<Project>(`/projects/${id}`)
      .then((p) => {
        const canEdit =
          !!user && !!current &&
          canEditProject(
            { createdBy: p.createdBy.id },
            { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
          );
        if (!canEdit) {
          setDenied(true);
          return;
        }
        setForm({
          name: p.name,
          description: p.description ?? '',
          variables: p.variables ?? [],
          status: p.status,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('projects.loadFailed')))
      .finally(() => setLoading(false));
  }, [id, user, current]);

  const cancelTo = isEdit ? `/projects/${id}` : '/projects';

  // Variables editor helpers (key/value rows; key sanitized like PipelineVarsEditor).
  const setVar = (i: number, patch: Partial<ProjectVariable>) =>
    setForm((f) => ({
      ...f,
      variables: f.variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    }));
  const removeVar = (i: number) =>
    setForm((f) => ({ ...f, variables: f.variables.filter((_, idx) => idx !== i) }));
  const addVar = () =>
    setForm((f) => ({ ...f, variables: [...f.variables, { key: '', value: '' }] }));

  async function save() {
    if (!wsId || !form.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    // Drop blank-key rows; trimmed keys.
    const variables = form.variables
      .map((v) => ({ key: v.key.trim(), value: v.value }))
      .filter((v) => v.key);
    // `shared` is intentionally omitted — the member picker is deferred, so a
    // published project is visible to everyone (backend defaults `shared: all`).
    const payload = {
      name: form.name.trim(),
      description: form.description,
      variables,
      status: form.status,
    };
    try {
      if (isEdit) {
        await api<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        navigate(`/projects/${id}`);
      } else {
        const created = await api<Project>(`/workspaces/${wsId}/projects`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (denied) {
    return <p className="empty">{t('projects.editDenied')}</p>;
  }

  return (
    <EditorShell
      onBack={() => navigate(cancelTo)}
      title={
        <input
          className="eshell-name"
          placeholder={t('projects.namePlaceholder')}
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
        />
      }
      actions={
        <>
          <button type="button" className="icon-btn-danger" title={t('common.cancel')} aria-label={t('common.cancel')} onClick={() => navigate(cancelTo)}>
            <XIcon />
          </button>
          <button
            type="button"
            className="icon-btn-success"
            title={isEdit ? t('projects.saveChanges') : t('projects.createProject')}
            aria-label={isEdit ? t('projects.saveChanges') : t('projects.createProject')}
            disabled={busy || !form.name.trim()}
            onClick={() => void save()}
          >
            <CheckIcon width={16} height={16} />
          </button>
        </>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="project-edit">
        <section className="project-edit-section">
          <div className="project-edit-section-head">
            <span className="pf-label">{t('projects.descriptionLabel')}</span>
            <p>{t('projects.descriptionHelp')}</p>
          </div>
          <div className="project-field project-field-stack">
            <textarea
              className="project-input project-textarea"
              placeholder={t('projects.descriptionPlaceholder')}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </section>

        <section className="project-edit-section">
          <div className="project-edit-section-head">
            <span className="pf-label">{t('projects.variablesLabel')}</span>
            <p>{t('projects.variablesHelpPre')} <code>{'{key}'}</code> {t('projects.variablesHelpPost')}</p>
          </div>
          <div className="project-vars">
            {form.variables.length === 0 ? (
              <p className="project-vars-empty">{t('projects.variablesEmptyPre')} <code>product</code>, <code>niche</code>, {t('projects.variablesEmptyOr')} <code>homepage</code>.</p>
            ) : (
              form.variables.map((v, i) => (
                <div key={i} className="project-vars-row">
                  <input
                    className="text-input"
                    placeholder={t('projects.varKeyPlaceholder')}
                    value={v.key}
                    onChange={(e) => setVar(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  />
                  <input
                    className="text-input"
                    placeholder={t('projects.varValuePlaceholder')}
                    value={v.value}
                    onChange={(e) => setVar(i, { value: e.target.value })}
                  />
                  <button className="icon-mini danger" title={t('projects.removeVariable')} onClick={() => removeVar(i)}>
                    ×
                  </button>
                </div>
              ))
            )}
            <button className="btn-ghost pvars-add btn-inline" onClick={addVar}>
              {t('projects.addVariable')}
            </button>
          </div>
        </section>

        <section className="project-edit-section">
          <div className="project-status-row">
            <div className="project-status-text">
              <span className="pf-label">{t('projects.status')}</span>
              <p>{t(STATUS_HELP_KEY[form.status])}</p>
            </div>
            <div className="seg" role="radiogroup" aria-label={t('projects.statusAria')}>
              {Object.values(ProjectStatus).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={form.status === s}
                  className={`seg-btn ${form.status === s ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, status: s })}
                >
                  <span className="sdot" style={{ background: STATUS_COLOR[s] }} />
                  {t(STATUS_KEY[s])}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </EditorShell>
  );
}
