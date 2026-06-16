import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  canEditProject,
  ProjectVisibility,
  type Project,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';

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
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/projects/${toDelete.id}`, { method: 'DELETE' });
      setProjects((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete project');
    } finally {
      setDeleting(false);
    }
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

      {error && !creating && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="empty">No projects yet. Create your first one.</p>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <div className={`project-card vis-${p.visibility}`} key={p.id}>
              <div className="project-card-head">
                <Link to={`/projects/${p.id}`} className="project-card-title">
                  {p.name}
                </Link>
                <span className={`badge vis-${p.visibility}`}>{VISIBILITY_LABELS[p.visibility]}</span>
              </div>
              <div className="project-card-sub">
                {[p.product, p.niche].filter(Boolean).join(' · ') || 'No details yet'}
              </div>
              {p.homepageUrl && <div className="project-card-meta">{p.homepageUrl}</div>}
              <div className="project-card-foot">
                <Link to={`/projects/${p.id}`} className="card-open">
                  Open workbench →
                </Link>
                {canEdit(p) && (
                  <button className="btn-danger" style={{ marginLeft: 'auto' }} onClick={() => setToDelete(p)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete project?"
        message={
          <>
            <strong>{toDelete?.name}</strong> and its runs will be permanently removed. This can’t be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
