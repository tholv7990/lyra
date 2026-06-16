import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tagColor, type Pipeline } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PipelinesIcon } from '../layout/icons';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Pipelines() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Pipeline | null>(null);
  const [deleting, setDeleting] = useState(false);

  const wsId = current?.id;

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<Pipeline[]>(`/workspaces/${wsId}/pipelines`)
      .then((list) => !cancelled && setPipelines(list))
      .catch(() => !cancelled && setPipelines([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [wsId]);

  const visible = useMemo(
    () => (q.trim() ? pipelines.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : pipelines),
    [pipelines, q],
  );

  const canEdit = (p: Pipeline) => !!user && (p.createdBy.id === user.id || current?.role === 'owner');

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<Pipeline>(`/workspaces/${wsId}/pipelines`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      navigate(`/pipelines/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pipeline');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/pipelines/${toDelete.id}`, { method: 'DELETE' });
      setPipelines((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete pipeline');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="prompts-head">
        <div className="titles">
          <h2>Pipelines</h2>
          <p>Reusable, composable flows — assign them to projects and run them.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} onClick={() => { setName(''); setError(null); setCreating(true); }}>
          New pipeline
        </button>
      </div>

      <div className="lin-toolbar">
        <input className="lin-search" placeholder="Search pipelines…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && !creating && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading pipelines…</p>
      ) : pipelines.length === 0 ? (
        <div className="prompt-empty">
          <div className="prompt-empty-art"><PipelinesIcon width={26} height={26} /></div>
          <h3>Build your first pipeline</h3>
          <p>Chain prompts into a flow — each step runs a prompt on a model you pick, feeding its output to the next.</p>
          <button className="btn-primary" onClick={() => { setName(''); setCreating(true); }}>New pipeline</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">No pipelines match your search.</p>
      ) : (
        <div className="ptable t-pipeline">
          <div className="ptable-head">
            <span>Name</span>
            <span>Tags</span>
            <span>Steps</span>
            <span>Updated</span>
            <span />
          </div>
          {visible.map((p) => (
            <div className="prow" key={p.id}>
              <Link className="prow-name" to={`/pipelines/${p.id}`}>
                <span className="nm">{p.name}</span>
                {p.description && <span className="snip">{p.description}</span>}
              </Link>
              <span className="prow-tags">
                {p.tags.slice(0, 3).map((t) => {
                  const c = tagColor(t);
                  return (
                    <span key={t} className="tag-chip ro" style={{ color: c, borderColor: `${c}55`, background: `${c}14` } as CSSProperties}>{t}</span>
                  );
                })}
                {p.tags.length > 3 && <span className="more">+{p.tags.length - 3}</span>}
              </span>
              <span className="prow-date">{p.steps.length}</span>
              <span className="prow-date">{fmtDate(p.updatedAt)}</span>
              <span className="prow-actions">
                <Link className="txt-btn accent" to={`/pipelines/${p.id}`}>Open</Link>
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
              <h3>New pipeline</h3>
              <button type="button" className="modal-x" onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <input className="text-input" placeholder="Pipeline name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <p className="empty" style={{ padding: 0, textAlign: 'left', fontSize: 13 }}>You'll add steps in the builder next.</p>
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={busy} style={{ width: 'auto', marginTop: 0 }}>
                {busy ? 'Creating…' : 'Create & edit'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete pipeline?"
        message={<><strong>{toDelete?.name}</strong> will be removed. Projects using it lose access. This can’t be undone.</>}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
