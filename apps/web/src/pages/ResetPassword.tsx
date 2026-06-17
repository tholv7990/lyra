import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (pw.next !== pw.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: pw.next }),
        retry: false,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="auth-card" onSubmit={onSubmit}>
        <img className="auth-logo" src="/lyra-logo-horizontal-light.svg" alt="Lyra" width={159} height={64} />
        <h1>Set a new password</h1>

        {!token ? (
          <>
            <p className="error">This reset link is missing its token.</p>
            <p className="switch"><Link to="/forgot-password">Request a new link</Link></p>
          </>
        ) : done ? (
          <>
            <p className="sub muted">Your password has been reset. You can sign in now.</p>
            <p className="switch"><Link to="/login">Sign in</Link></p>
          </>
        ) : (
          <>
            <p className="sub muted">Choose a new password for your account.</p>
            {error && <p className="error">{error}</p>}
            <label className="field">
              <span>New password</span>
              <input
                className="text-input"
                type="password"
                autoComplete="new-password"
                required
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                className="text-input"
                type="password"
                autoComplete="new-password"
                required
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </label>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
