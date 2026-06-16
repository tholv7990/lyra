import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tagColor, type Pipeline } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PipelinesIcon } from '../layout/icons';

export function Pipelines() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
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
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const canEdit = (p: Pipeline) =>
    !!user && (p.createdBy.id === user.id || current?.role === 'owner');

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
        {!creating && (
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            onClick={() => setCreating(true)}
          >
            New pipeline
          </button>
        )}
      </div>

      {creating && (
        <form className="form-inline" onSubmit={onCreate}>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <input
            className="text-input"
            placeholder="Pipeline name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 0, width: 'auto' }}>
              {busy ? 'Creating…' : 'Create & edit'}
            </button>
            <button className="btn-ghost" type="button" onClick={() => { setCreating(false); setError(null); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && !creating && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading pipelines…</p>
      ) : pipelines.length === 0 && !creating ? (
        <div className="prompt-empty">
          <div className="prompt-empty-art">
            <PipelinesIcon width={26} height={26} />
          </div>
          <h3>Build your first pipeline</h3>
          <p>
            Chain prompts into a flow — each step runs a prompt on a model you pick,
            feeding its output to the next. Assign pipelines to projects to run them.
          </p>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            New pipeline
          </button>
        </div>
      ) : (
        <div className="prompt-grid">
          {pipelines.map((p) => (
            <Link to={`/pipelines/${p.id}`} className="prompt-card" key={p.id} style={{ textDecoration: 'none' }}>
              <div className="prompt-card-head">
                <span className="prompt-card-title">{p.name}</span>
                <span className="badge">{p.steps.length} step{p.steps.length === 1 ? '' : 's'}</span>
              </div>
              {p.description && <div className="prompt-body">{p.description}</div>}
              {p.tags.length > 0 && (
                <div className="prompt-tags">
                  {p.tags.map((t) => {
                    const c = tagColor(t);
                    return (
                      <span key={t} className="tag-chip ro" style={{ color: c, borderColor: `${c}55`, background: `${c}14` } as CSSProperties}>
                        <span className="tdot" style={{ background: c }} />
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="prompt-card-foot">
                <span className="prompt-author">
                  by {p.createdBy.name}
                </span>
                <div className="prompt-actions">
                  <span className="txt-btn accent">Open →</span>
                  {canEdit(p) && (
                    <button
                      className="txt-btn danger"
                      onClick={(e) => { e.preventDefault(); setToDelete(p); }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete pipeline?"
        message={
          <>
            <strong>{toDelete?.name}</strong> will be removed. Projects using it will
            lose access. This can’t be undone.
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
