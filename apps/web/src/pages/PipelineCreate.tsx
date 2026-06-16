import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type Pipeline } from '@lyra/shared';
import { api } from '../lib/api';
import { useWorkspace } from '../workspace/useWorkspace';
import { TagInput } from '../components/TagInput';

// Create the pipeline record, then drop straight into the builder to add steps.
export function PipelineCreate() {
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wsId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<Pipeline>(`/workspaces/${wsId}/pipelines`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description, tags }),
      });
      navigate(`/pipelines/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pipeline');
      setBusy(false);
    }
  }

  return (
    <div className="editor">
      <Link to="/pipelines" className="pg-back">← Pipelines</Link>
      <h2 className="editor-title">New pipeline</h2>

      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit}>
        <label className="pf-field">
          <span className="pf-label">Name</span>
          <input className="text-input" placeholder="Pipeline name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Description</span>
          <input className="text-input" placeholder="What this pipeline does (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="pf-field">
          <span className="pf-label">Tags</span>
          <TagInput value={tags} suggestions={[]} onChange={setTags} />
        </div>
        <p className="empty" style={{ padding: 0, textAlign: 'left', fontSize: 13 }}>You'll add steps in the builder next.</p>

        <div className="editor-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate('/pipelines')}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={busy || !name.trim()} style={{ width: 'auto', marginTop: 0 }}>
            {busy ? 'Creating…' : 'Create & edit'}
          </button>
        </div>
      </form>
    </div>
  );
}
