import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SignupDto } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { AuthTopBar } from '../components/AuthTopBar';
import { BrandLogo } from '../components/BrandLogo';
import { GoogleButton } from '../components/GoogleButton';

export function Signup() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const [form, setForm] = useState<SignupDto>({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      setSentTo(form.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <AuthTopBar />
      <form className="auth-card" onSubmit={onSubmit}>
        <BrandLogo className="auth-logo" width={159} height={64} />
        <h1>{sentTo ? t('auth.confirmTitle') : t('auth.signupTitle')}</h1>
        <p className="sub muted">
          {sentTo ? t('auth.confirmSubtitle') : t('auth.signupSubtitle')}
        </p>

        {error && <p className="error">{error}</p>}
        {sentTo && (
          <p className="notice">
            {t('auth.confirmSent', { email: sentTo })}
          </p>
        )}

        {!sentTo && (
          <>
            <GoogleButton label={t('auth.signUpGoogle')} />
            <div className="auth-or"><span>{t('auth.or')}</span></div>

            <label className="field">
              <span>{t('auth.name')}</span>
              <input
                className="text-input"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="field">
              <span>{t('auth.email')}</span>
              <input
                className="text-input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>

            <label className="field">
              <span>{t('auth.password')}</span>
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
              {busy ? t('auth.signingUp') : t('auth.signUp')}
            </button>
          </>
        )}

        <p className="switch">
          {t('auth.haveAccount')} <Link to="/login">{t('auth.signInLink')}</Link>
        </p>
      </form>
    </div>
  );
}
