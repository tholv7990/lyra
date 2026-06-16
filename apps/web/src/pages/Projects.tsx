import { useEffect, useState, type FormEvent } from 'react';
import {
  canEditProject,
  ProjectVisibility,
  type Project,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  [ProjectVisibility.Private]: 'Private',
  [ProjectVisibility.Shared]: 'Shared',
  [ProjectVisibility.Workspace]: 'Workspace',
};

const empty = { name: '', product: '', niche: '', homepageUrl: '' };

export function Projects() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsId = current?.id;

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Project[]>(`/workspaces/${wsId}/projects`)
      .then((list) => !cancelled && setProjects(list))
      .catch(() => !cancelled && setProjects([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  function canEdit(p: Project) {
    if (!current || !user) return false;
    return canEditProject(p, {
      userId: user.id,
      role: current.role,
      canManageKeys: current.canManageKeys,
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<Project>(`/workspaces/${wsId}/projects`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setProjects((p) => [created, ...p]);
      setForm(empty);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
    } finally {
      setBusy(false);
    }
  }

  async function changeVisibility(p: Project, visibility: ProjectVisibility) {
    const updated = await api<Project>(`/projects/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    });
    setProjects((list) => list.map((x) => (x.id === p.id ? updated : x)));
  }

  async function remove(p: Project) {
    await api(`/projects/${p.id}`, { method: 'DELETE', retry: true });
    setProjects((list) => list.filter((x) => x.id !== p.id));
  }

  return (
    <div>
      <div className="section-head">
        <h2>Projects</h2>
        {!creating && (
          <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} onClick={() => setCreating(true)}>
            New project
          </button>
        )}
      </div>

      {creating && (
        <form className="form-inline" onSubmit={onCreate}>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <input className="text-input" placeholder="Name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="text-input" placeholder="Product" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
          <input className="text-input" placeholder="Niche" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
          <input className="text-input" placeholder="Homepage URL" value={form.homepageUrl} onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 0 }}>
              {busy ? 'Creating…' : 'Create project'}
            </button>
            <button className="btn-ghost" type="button" onClick={() => { setCreating(false); setError(null); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="empty">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="empty">No projects yet. Create your first one.</p>
      ) : (
        <div className="list">
          {projects.map((p) => (
            <div className="row" key={p.id}>
              <div className="grow">
                <div className="title">{p.name}</div>
                <div className="sub">
                  {[p.product, p.niche].filter(Boolean).join(' · ') || 'No details yet'}
                </div>
              </div>
              {canEdit(p) ? (
                <div className="row-actions">
                  <select
                    className="text-input select-sm"
                    value={p.visibility}
                    onChange={(e) => void changeVisibility(p, e.target.value as ProjectVisibility)}
                  >
                    {Object.values(ProjectVisibility).map((v) => (
                      <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                    ))}
                  </select>
                  <button className="btn-ghost" onClick={() => void remove(p)}>Delete</button>
                </div>
              ) : (
                <span className="badge">{VISIBILITY_LABELS[p.visibility]}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
