import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LoginDto } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { GoogleButton } from '../components/GoogleButton';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

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
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Login failed';
      // The API returns a deliberately vague "Invalid credentials" for both
      // unknown email and wrong password — present it in plain language.
      setError(raw === 'Invalid credentials' ? 'Email or password is incorrect.' : raw);
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
          <div className="pw-wrap">
            <input
              className="text-input"
              type={showPw ? 'text' : 'password'}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              title={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
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
