import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LoginDto } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
        <div className="logo-mark">Ly</div>
        <h1>Welcome back</h1>
        <p className="sub muted">Sign in to your Lyra workspace</p>

        {error && <p className="error">{error}</p>}

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
