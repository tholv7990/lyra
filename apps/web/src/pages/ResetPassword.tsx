import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthTopBar } from '../components/AuthTopBar';
import { BrandLogo } from '../components/BrandLogo';
import { api } from '../lib/api';

export function ResetPassword() {
  const { t } = useTranslation();
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
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (pw.next !== pw.confirm) {
      setError(t('auth.passwordsNoMatch'));
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
      setError(err instanceof Error ? err.message : t('auth.resetFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <AuthTopBar />
      <form className="auth-card" onSubmit={onSubmit}>
        <BrandLogo className="auth-logo" width={159} height={64} />
        <h1>{t('auth.resetTitle')}</h1>

        {!token ? (
          <>
            <p className="error">{t('auth.resetMissingToken')}</p>
            <p className="switch"><Link to="/forgot-password">{t('auth.requestNewLink')}</Link></p>
          </>
        ) : done ? (
          <>
            <p className="sub muted">{t('auth.resetSuccess')}</p>
            <p className="switch"><Link to="/login">{t('auth.signIn')}</Link></p>
          </>
        ) : (
          <>
            <p className="sub muted">{t('auth.resetSubtitle')}</p>
            {error && <p className="error">{error}</p>}
            <label className="field">
              <span>{t('auth.newPassword')}</span>
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
              <span>{t('auth.confirmPassword')}</span>
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
              {busy ? t('auth.resettingPassword') : t('auth.resetPassword')}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
