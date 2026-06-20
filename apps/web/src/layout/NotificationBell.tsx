import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLE_LABELS } from '../lib/constants';
import { initial, avatarStyle } from '../lib/format';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useInvites } from '../hooks/useInvites';
import { useWorkspace } from '../workspace/useWorkspace';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import { IconButton } from '../components/IconButton';
import { BellIcon } from './icons';

export function NotificationBell() {
  const { t } = useTranslation();
  const { invites, loading, accept, decline } = useInvites();
  const { refresh: refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const unverified = user?.emailVerified === false;
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const count = invites.length + (unverified ? 1 : 0);
  const label = count > 0 ? `${t('notifications.label')}, ${t('notifications.pending', { count })}` : t('notifications.label');

  function resendVerification() {
    api<{ ok: boolean }>('/auth/resend-verification', { method: 'POST' })
      .then(() => setResent(true))
      .catch(() => setResent(true));
  }

  async function onAccept(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await accept(id);
      await refreshWorkspaces(); // the joined workspace appears in the switcher
    } catch {
      setError(t('notifications.acceptFailed'));
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await decline(id);
    } catch {
      setError(t('notifications.declineFailed'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="notif" ref={ref}>
      <IconButton
        icon={<BellIcon />}
        label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {count > 0 && (
        <span className="notif-badge" aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
      )}

      {open && (
        <div className="notif-pop" role="menu">
          {unverified && (
            <div className="notif-item" role="menuitem">
              <span className="notif-avatar" style={avatarStyle('email')} aria-hidden="true">✉</span>
              <div className="notif-body">
                <p className="notif-text">{t('notifications.confirmEmail')}</p>
                <div className="notif-actions">
                  <button className="btn-primary" disabled={resent} onClick={resendVerification}>
                    {resent ? t('notifications.resent') : t('notifications.resend')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {loading ? (
            <p className="notif-empty">{t('notifications.loading')}</p>
          ) : invites.length === 0 ? (
            !unverified && <p className="notif-empty">{t('notifications.empty')}</p>
          ) : (
            invites.map((inv) => (
              <div className="notif-item" key={inv.id} role="menuitem">
                <span className="notif-avatar" style={avatarStyle(inv.workspaceName)} aria-hidden="true">
                  {initial(inv.workspaceName)}
                </span>
                <div className="notif-body">
                  <p className="notif-text">
                    {t('notifications.invitedYou', {
                      inviter: inv.invitedBy.name,
                      workspace: inv.workspaceName,
                      role: ROLE_LABELS[inv.role],
                    })}
                  </p>
                  <div className="notif-actions">
                    <button className="btn-primary" disabled={busyId === inv.id} onClick={() => onAccept(inv.id)}>
                      {busyId === inv.id ? t('notifications.accepting') : t('notifications.accept')}
                    </button>
                    <button className="btn-ghost" disabled={busyId === inv.id} onClick={() => onDecline(inv.id)}>
                      {t('notifications.decline')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
          {error && <p className="notif-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
