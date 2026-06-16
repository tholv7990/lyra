import { useState, type FormEvent } from 'react';
import { useWorkspace } from './useWorkspace';

export function WorkspaceSwitcher() {
  const { workspaces, current, setCurrent, createWorkspace } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createWorkspace({ name: name.trim() });
      setName('');
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <label className="field" style={{ marginBottom: 0 }}>
        <span>Workspace</span>
        <select
          className="text-input"
          value={current?.id ?? ''}
          onChange={(e) => setCurrent(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
              {w.type === 'personal' ? ' (personal)' : ''} · {w.role}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      {creating ? (
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 8 }}>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New workspace name"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" type="submit" disabled={busy} style={{ flex: 1 }}>
              {busy ? 'Creating…' : 'Create'}
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn-ghost" type="button" onClick={() => setCreating(true)}>
          + New team workspace
        </button>
      )}
    </div>
  );
}
