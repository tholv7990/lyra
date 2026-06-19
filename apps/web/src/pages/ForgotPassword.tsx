import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthTopBar } from '../components/AuthTopBar';
import { BrandLogo } from '../components/BrandLogo';
import { api } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        retry: false,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <AuthTopBar />
      <form className="auth-card" onSubmit={onSubmit}>
        <BrandLogo className="auth-logo" width={159} height={64} />
        <h1>Reset your password</h1>

        {sent ? (
          <>
            <p className="sub muted">
              If an account exists for <strong>{email}</strong>, we’ve emailed a reset link. It’s valid for one hour.
            </p>
            <p className="switch"><Link to="/login">Back to sign in</Link></p>
          </>
        ) : (
          <>
            <p className="sub muted">Enter your email and we’ll send you a reset link.</p>
            {error && <p className="error">{error}</p>}
            <label className="field">
              <span>Email</span>
              <input
                className="text-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="switch">Remembered it? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </form>
    </div>
  );
}
