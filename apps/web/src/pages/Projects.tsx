import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { canEditProject, ProjectVisibility, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProjectsIcon } from '../layout/icons';

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  [ProjectVisibility.Private]: 'Private',
  [ProjectVisibility.Shared]: 'Shared',
  [ProjectVisibility.Workspace]: 'Workspace',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const emptyForm = { name: '', product: '', niche: '', homepageUrl: '' };

export function Projects() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
    return () => { cancelled = true; };
  }, [wsId]);

  const visible = useMemo(
    () => (q.trim() ? projects.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : projects),
    [projects, q],
  );

  function canEdit(p: Project) {
    if (!current || !user) return false;
    return canEditProject(
      { createdBy: p.createdBy.id },
      { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
    );
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
      setForm(emptyForm);
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
      <div className="prompts-head">
        <div className="titles">
          <h2>Projects</h2>
          <p>A project per brand or product — assign pipelines and run them here.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} onClick={() => { setForm(emptyForm); setError(null); setCreating(true); }}>
          New project
        </button>
      </div>

      <div className="lin-toolbar">
        <input className="lin-search" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && !creating && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="prompt-empty">
          <div className="prompt-empty-art"><ProjectsIcon width={26} height={26} /></div>
          <h3>Create your first project</h3>
          <p>A project holds a brand or product. Assign pipelines and run them to produce on-brand content.</p>
          <button className="btn-primary" onClick={() => { setForm(emptyForm); setCreating(true); }}>New project</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">No projects match your search.</p>
      ) : (
        <div className="ptable t-project">
          <div className="ptable-head">
            <span>Name</span>
            <span>Visibility</span>
            <span>Product</span>
            <span>Updated</span>
            <span />
          </div>
          {visible.map((p) => (
            <div className="prow" key={p.id}>
              <Link className="prow-name" to={`/projects/${p.id}`}>
                <span className="nm">{p.name}</span>
                {p.niche && <span className="snip">{p.niche}</span>}
              </Link>
              <span>
                <span className={`badge vis-${p.visibility}`}>{VISIBILITY_LABELS[p.visibility]}</span>
              </span>
              <span className="prow-date" style={{ whiteSpace: 'normal' }}>{p.product || '—'}</span>
              <span className="prow-date">{fmtDate(p.updatedAt)}</span>
              <span className="prow-actions">
                <Link className="txt-btn accent" to={`/projects/${p.id}`}>Open</Link>
                {canEdit(p) && <button className="txt-btn danger" onClick={() => setToDelete(p)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="modal-scrim" onClick={() => setCreating(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onCreate}>
            <div className="modal-head">
              <h3>New project</h3>
              <button type="button" className="modal-x" onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <input className="text-input" placeholder="Project name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="text-input" placeholder="Product" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            <input className="text-input" placeholder="Niche" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
            <input className="text-input" placeholder="Homepage URL" value={form.homepageUrl} onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })} />
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={busy} style={{ width: 'auto', marginTop: 0 }}>
                {busy ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete project?"
        message={<><strong>{toDelete?.name}</strong> and its runs will be removed. This can’t be undone.</>}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
