import { useState } from 'react';
import { useAuth } from '../auth/useAuth';

export function Dashboard() {
  const { user, logout } = useAuth();
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
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          You're signed in. The workspace switcher, projects, and the 8-step
          pipeline land in the next phases.
        </p>
        <button className="btn-ghost" onClick={onLogout} disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
