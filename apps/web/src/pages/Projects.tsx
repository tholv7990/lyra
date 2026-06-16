import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { canEditProject, ProjectVisibility, type Project } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProjectsIcon, PlusIcon } from '../layout/icons';

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  [ProjectVisibility.Private]: 'Private',
  [ProjectVisibility.Shared]: 'Shared',
  [ProjectVisibility.Workspace]: 'Workspace',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const PAGE_SIZE = 10;

export function Projects() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
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

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function canEdit(p: Project) {
    if (!current || !user) return false;
    return canEditProject(
      { createdBy: p.createdBy.id },
      { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
    );
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
      </div>

      <div className="lin-toolbar">
        <input className="lin-search" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="lin-add" onClick={() => navigate('/projects/new')} title="New project" aria-label="New project">
          <PlusIcon />
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="prompt-empty">
          <div className="prompt-empty-art"><ProjectsIcon width={26} height={26} /></div>
          <h3>Create your first project</h3>
          <p>A project holds a brand or product. Assign pipelines and run them to produce on-brand content.</p>
          <button className="btn-primary" onClick={() => navigate('/projects/new')}>New project</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">No projects match your search.</p>
      ) : (
        <>
        <div className="ptable t-project">
          <div className="ptable-head">
            <span>Name</span>
            <span>Visibility</span>
            <span>Product</span>
            <span>Updated</span>
            <span />
          </div>
          {pageItems.map((p) => (
            <div
              className="prow"
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${p.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${p.id}`); }}
            >
              <div className="prow-name">
                <span className="nm">{p.name}</span>
                {p.niche && <span className="snip">{p.niche}</span>}
              </div>
              <span>
                <span className={`badge vis-${p.visibility}`}>{VISIBILITY_LABELS[p.visibility]}</span>
              </span>
              <span className="prow-date" style={{ whiteSpace: 'normal' }}>{p.product || '—'}</span>
              <span className="prow-date">{fmtDate(p.updatedAt)}</span>
              <span className="prow-actions" onClick={(e) => e.stopPropagation()}>
                <Link className="txt-btn accent" to={`/projects/${p.id}`}>Open</Link>
                {canEdit(p) && <Link className="txt-btn" to={`/projects/${p.id}/edit`}>Edit</Link>}
                {canEdit(p) && <button className="txt-btn danger" onClick={() => setToDelete(p)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="pager-info">Page {page} of {totalPages} · {visible.length} total</span>
            <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
        </>
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
