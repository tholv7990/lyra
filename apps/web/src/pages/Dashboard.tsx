import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';

export function Dashboard() {
  const { user, logout } = useAuth();
  const { current, loading } = useWorkspace();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    await logout();
    setBusy(false);
  }

  return (
    <div className="center">
      <div className="auth-card dashboard">
        <div className="logo-mark">Ly</div>
        <h1>Welcome, {user?.name}</h1>
        <p className="sub muted">{user?.email}</p>

        <div style={{ margin: '8px 0 20px' }}>
          {loading ? (
            <p className="muted">Loading workspaces…</p>
          ) : (
            <WorkspaceSwitcher />
          )}
        </div>

        <p className="muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          {current
            ? `Active workspace: ${current.name} (${current.type}). Projects and the 8-step pipeline land in the next phases.`
            : 'No workspace selected.'}
        </p>

        <button
          className="btn-ghost"
          onClick={onLogout}
          disabled={busy}
          style={{ width: '100%' }}
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
