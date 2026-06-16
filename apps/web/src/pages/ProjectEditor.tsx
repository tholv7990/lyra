import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { canEditProject, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';

const empty = { name: '', product: '', niche: '', homepageUrl: '' };

export function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [form, setForm] = useState(empty);
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
        setForm({ name: p.name, product: p.product, niche: p.niche, homepageUrl: p.homepageUrl });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load project'))
      .finally(() => setLoading(false));
  }, [id, user, current]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !form.name.trim()) return;
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
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">Loading…</p>;
  if (denied) {
    return (
      <div className="editor">
        <Link to="/projects" className="pg-back">← Projects</Link>
        <p className="empty">You don't have permission to edit this project.</p>
      </div>
    );
  }

  return (
    <div className="editor">
      <Link to={isEdit ? `/projects/${id}` : '/projects'} className="pg-back">← Back</Link>
      <h2 className="editor-title">{isEdit ? 'Edit project' : 'New project'}</h2>

      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit}>
        <label className="pf-field">
          <span className="pf-label">Name</span>
          <input className="text-input" placeholder="Project name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Product</span>
          <input className="text-input" placeholder="What you're marketing" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Niche</span>
          <input className="text-input" placeholder="Market / audience" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Homepage URL</span>
          <input className="text-input" placeholder="https://…" value={form.homepageUrl} onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })} />
        </label>

        <div className="editor-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={busy || !form.name.trim()} style={{ width: 'auto', marginTop: 0 }}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}
