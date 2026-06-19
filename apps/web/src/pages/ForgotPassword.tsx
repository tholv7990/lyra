import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthTopBar } from '../components/AuthTopBar';
import { BrandLogo } from '../components/BrandLogo';
import { api } from '../lib/api';

export function ForgotPassword() {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <AuthTopBar />
      <form className="auth-card" onSubmit={onSubmit}>
        <BrandLogo className="auth-logo" width={159} height={64} />
        <h1>{t('auth.forgotTitle')}</h1>

        {sent ? (
          <>
            <p className="sub muted">
              {t('auth.resetSentFor', { email })}
            </p>
            <p className="switch"><Link to="/login">{t('auth.backToLogin')}</Link></p>
          </>
        ) : (
          <>
            <p className="sub muted">{t('auth.forgotSubtitle')}</p>
            {error && <p className="error">{error}</p>}
            <label className="field">
              <span>{t('auth.email')}</span>
              <input
                className="text-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
            </button>
            <p className="switch">{t('auth.remembered')} <Link to="/login">{t('auth.signIn')}</Link></p>
          </>
        )}
      </form>
    </div>
  );
}
