import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  ProjectStatus,
  type Project,
  type ProjectVariable,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon, XIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'Draft',
  [ProjectStatus.Public]: 'Public',
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: '#d4a72c',
  [ProjectStatus.Public]: '#2da44e',
};
// Shown beneath the toggle; reflects what the current status actually does.
// (Member-level sharing is deferred — a public project is visible to everyone.)
const STATUS_HELP: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'Only you and workspace owners can see it.',
  [ProjectStatus.Public]: 'Everyone in this workspace can see it.',
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
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [form, setForm] = useState<Form>(empty);
  useBreadcrumb(isEdit ? form.name.trim() || '…' : 'New');
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
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load project'))
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
      setError(err instanceof Error ? err.message : 'Could not save project');
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">Loading…</p>;
  if (denied) {
    return <p className="empty">You don't have permission to edit this project.</p>;
  }

  return (
    <EditorShell
      onBack={() => navigate(cancelTo)}
      title={
        <input
          className="eshell-name"
          placeholder="Project name"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
        />
      }
      actions={
        <>
          <button type="button" className="icon-btn-danger" title="Cancel" aria-label="Cancel" onClick={() => navigate(cancelTo)}>
            <XIcon />
          </button>
          <button
            type="button"
            className="icon-btn-success"
            title={isEdit ? 'Save changes' : 'Create project'}
            aria-label={isEdit ? 'Save changes' : 'Create project'}
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
            <span className="pf-label">Description</span>
            <p>A short summary of this brand or product.</p>
          </div>
          <div className="project-field project-field-stack">
            <textarea
              className="project-input project-textarea"
              placeholder="What this project is about — the brand, product, or store it represents."
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </section>

        <section className="project-edit-section">
          <div className="project-edit-section-head">
            <span className="pf-label">Variables</span>
            <p>Key→value pairs that fill <code>{'{key}'}</code> placeholders in step prompts at run time.</p>
          </div>
          <div className="project-vars">
            {form.variables.length === 0 ? (
              <p className="project-vars-empty">No variables yet. Add e.g. <code>product</code>, <code>niche</code>, or <code>homepage</code>.</p>
            ) : (
              form.variables.map((v, i) => (
                <div key={i} className="project-vars-row">
                  <input
                    className="text-input"
                    placeholder="key"
                    value={v.key}
                    onChange={(e) => setVar(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  />
                  <input
                    className="text-input"
                    placeholder="value"
                    value={v.value}
                    onChange={(e) => setVar(i, { value: e.target.value })}
                  />
                  <button className="icon-mini danger" title="Remove variable" onClick={() => removeVar(i)}>
                    ×
                  </button>
                </div>
              ))
            )}
            <button className="btn-ghost pvars-add" style={{ width: 'auto', marginTop: 0 }} onClick={addVar}>
              + Add variable
            </button>
          </div>
        </section>

        <section className="project-edit-section">
          <div className="project-status-row">
            <div className="project-status-text">
              <span className="pf-label">Status</span>
              <p>{STATUS_HELP[form.status]}</p>
            </div>
            <div className="seg" role="radiogroup" aria-label="Project status">
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
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </EditorShell>
  );
}
