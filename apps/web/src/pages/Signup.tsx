import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SignupDto } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { GoogleButton } from '../components/GoogleButton';

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupDto>({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Light client-side check; the server is the source of truth.
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      await signup(form);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
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
        <h1>Create your account</h1>
        <p className="sub muted">Start running the Lyra pipeline</p>

        {error && <p className="error">{error}</p>}

        <GoogleButton label="Sign up with Google" />
        <div className="auth-or"><span>or</span></div>

        <label className="field">
          <span>Name</span>
          <input
            className="text-input"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

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
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
