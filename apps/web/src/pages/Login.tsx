import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LoginDto } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { GoogleButton } from '../components/GoogleButton';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const googleError =
    params.get('error') === 'google'
      ? 'Google sign-in failed. Please try again.'
      : params.get('error') === 'google_unavailable'
        ? 'Google sign-in isn’t set up yet.'
        : null;
  const [form, setForm] = useState<LoginDto>({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="auth-card" onSubmit={onSubmit}>
        <img
          className="auth-logo"
          src="/lyra-logo-horizontal-light.svg"
          alt="Lyra"
          width={159}
          height={64}
        />
        <h1>Welcome back</h1>
        <p className="sub muted">Sign in to your Lyra workspace</p>

        {(error || googleError) && <p className="error">{error ?? googleError}</p>}

        <GoogleButton />
        <div className="auth-or"><span>or</span></div>

        <label className="field">
          <span>Email</span>
          <input
            className="text-input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            className="text-input"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>

        <div className="auth-aux">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="switch">
          New to Lyra? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
