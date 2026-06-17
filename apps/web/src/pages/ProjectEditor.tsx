import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { canEditProject, ProjectVisibility, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon, XIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

const VIS_LABEL: Record<ProjectVisibility, string> = {
  [ProjectVisibility.Private]: 'Private — only you',
  [ProjectVisibility.Shared]: 'Shared — chosen members',
  [ProjectVisibility.Workspace]: 'Workspace — all members',
};

const empty = {
  name: '',
  product: '',
  niche: '',
  homepageUrl: '',
  visibility: ProjectVisibility.Private,
};

export function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [form, setForm] = useState(empty);
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
        setForm({ name: p.name, product: p.product, niche: p.niche, homepageUrl: p.homepageUrl, visibility: p.visibility });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load project'))
      .finally(() => setLoading(false));
  }, [id, user, current]);

  const cancelTo = isEdit ? `/projects/${id}` : '/projects';

  async function save() {
    if (!wsId || !form.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        await api<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(form) });
        navigate(`/projects/${id}`);
      } else {
        const created = await api<Project>(`/workspaces/${wsId}/projects`, {
          method: 'POST',
          body: JSON.stringify(form),
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
          <button type="button" className="icon-btn-success" title={isEdit ? 'Save changes' : 'Create project'} aria-label={isEdit ? 'Save changes' : 'Create project'} disabled={busy || !form.name.trim()} onClick={() => void save()}>
            <CheckIcon width={16} height={16} />
          </button>
        </>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="eshell-form">
        <div className="pf-field">
          <span className="pf-label">Product</span>
          <input className="text-input" placeholder="What you're marketing" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
        </div>
        <div className="pf-field">
          <span className="pf-label">Niche</span>
          <input className="text-input" placeholder="Market / audience" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
        </div>
        <div className="pf-field">
          <span className="pf-label">Homepage URL</span>
          <input className="text-input" placeholder="https://…" value={form.homepageUrl} onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })} />
        </div>
        {isEdit && (
          <div className="pf-field">
            <span className="pf-label">Visibility</span>
            <select
              className="text-input"
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as ProjectVisibility })}
            >
              {Object.values(ProjectVisibility).map((v) => (
                <option key={v} value={v}>{VIS_LABEL[v]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </EditorShell>
  );
}
