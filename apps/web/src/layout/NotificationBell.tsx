import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { MyInvite } from '@lyra/shared';
import { ROLE_LABELS } from '../lib/constants';
import { initial, avatarStyle, fmtDate } from '../lib/format';
import { useInvites } from '../hooks/useInvites';
import { useWorkspace } from '../workspace/useWorkspace';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import { useEscapeKey } from '../lib/useEscapeKey';
import { IconButton } from '../components/IconButton';
import { BellIcon, XIcon, SettingsIcon } from './icons';

const PER_PAGE = 5;
const DISMISS_KEY = 'lyra:notif-dismissed';

// One bell row. System logs (e.g. confirm-email) carry a system icon + a delete;
// user activities (invites) carry the actor's avatar + their own actions.
interface Activity {
  id: string;
  kind: 'system' | 'user';
  title: string;
  content?: string;
  date?: string;
  avatarSeed?: string;
  invite?: MyInvite;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { invites, loading, accept, decline } = useInvites();
  const { refresh: refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const unverified = user?.emailVerified === false;

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // The popup is portaled out of the topbar (its backdrop-filter clips absolutely
  // positioned children), so close-on-outside-click must check BOTH the bell and
  // the portaled popup.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (wrapRef.current?.contains(tgt) || popRef.current?.contains(tgt)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);
  useEscapeKey(() => setOpen(false), open);

  const activities = useMemo<Activity[]>(() => {
    const list: Activity[] = [];
    if (unverified && !dismissed.includes('confirm-email')) {
      list.push({
        id: 'confirm-email',
        kind: 'system',
        title: t('notifications.confirmEmailTitle'),
        content: t('notifications.confirmEmail'),
      });
    }
    for (const inv of invites) {
      list.push({
        id: inv.id,
        kind: 'user',
        title: t('notifications.inviteTitle'),
        content: t('notifications.invitedYou', {
          inviter: inv.invitedBy.name,
          workspace: inv.workspaceName,
          role: ROLE_LABELS[inv.role],
        }),
        date: inv.createdAt,
        avatarSeed: inv.invitedBy.name,
        invite: inv,
      });
    }
    return list;
  }, [unverified, dismissed, invites, t]);

  const count = activities.length;
  const shown = activities.slice(0, page * PER_PAGE);
  const hasMore = activities.length > shown.length;
  const label =
    count > 0 ? `${t('notifications.label')}, ${t('notifications.pending', { count })}` : t('notifications.label');

  function dismiss(id: string) {
    setDismissed((d) => {
      const next = [...d, id];
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      return next;
    });
  }

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
      await refreshWorkspaces();
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
    <div className="notif" ref={wrapRef}>
      <IconButton
        boxed
        icon={<BellIcon />}
        label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setPage(1);
          setOpen((o) => !o);
        }}
      />
      {count > 0 && (
        <span className="notif-badge" aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
      )}

      {open &&
        createPortal(
          <div className="notif-pop" ref={popRef} role="menu">
            <div className="notif-pop-head">{t('notifications.label')}</div>
            {loading && count === 0 ? (
              <p className="notif-empty">{t('notifications.loading')}</p>
            ) : count === 0 ? (
              <p className="notif-empty">{t('notifications.empty')}</p>
            ) : (
              <>
                {shown.map((a) => (
                  <div className="notif-card" key={a.id} role="menuitem">
                    <span className={`notif-ic ${a.kind}`} style={a.kind === 'user' ? avatarStyle(a.avatarSeed ?? '') : undefined} aria-hidden="true">
                      {a.kind === 'system' ? <SettingsIcon width={15} height={15} /> : initial(a.avatarSeed)}
                    </span>
                    <div className="notif-card-body">
                      <div className="notif-card-head">
                        <span className="notif-card-title">{a.title}</span>
                        {a.date && <span className="notif-card-date">{fmtDate(a.date)}</span>}
                      </div>
                      {a.content && <p className="notif-card-text">{a.content}</p>}
                      <div className="notif-card-actions">
                        {a.invite ? (
                          <>
                            <button className="btn-primary" disabled={busyId === a.id} onClick={() => onAccept(a.invite!.id)}>
                              {busyId === a.id ? t('notifications.accepting') : t('notifications.accept')}
                            </button>
                            <button className="btn-ghost" disabled={busyId === a.id} onClick={() => onDecline(a.invite!.id)}>
                              {t('notifications.decline')}
                            </button>
                          </>
                        ) : a.id === 'confirm-email' ? (
                          <button className="btn-primary" disabled={resent} onClick={resendVerification}>
                            {resent ? t('notifications.resent') : t('notifications.resend')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {!a.invite && (
                      <button className="notif-del" title={t('notifications.delete')} aria-label={t('notifications.delete')} onClick={() => dismiss(a.id)}>
                        <XIcon width={13} height={13} />
                      </button>
                    )}
                  </div>
                ))}
                {hasMore && (
                  <button className="notif-more" onClick={() => setPage((p) => p + 1)}>
                    {t('notifications.loadMore')}
                  </button>
                )}
              </>
            )}
            {error && <p className="notif-error">{error}</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}
