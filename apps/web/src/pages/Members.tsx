import { useCallback, useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Role, WorkspaceType } from '@lyra/shared';
import type { Invite, MemberView } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { api } from '../lib/api';
import { initial, avatarStyle, fmtDate } from '../lib/format';
import { toggleInList } from '../lib/array';
import { ROLE_LABELS } from '../lib/constants';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconButton } from '../components/IconButton';
import { FilterPopover } from '../components/FilterPopover';
import { RequestTeamUpgradeModal } from '../components/RequestTeamUpgradeModal';
import { MembersIcon, PlusIcon, XIcon } from '../layout/icons';
import './members.css';

// Assignable roles. Owner = full control, Member = create/run, Viewer = read-only.
// The picker, invite form, and role filter read labels from the shared ROLE_LABELS.
const ROLES: Role[] = [Role.Owner, Role.Member, Role.Viewer];

// Workspace Members: the owner-side counterpart to the notification bell. Any
// member can see who's in the workspace; the owner can invite by email, change a
// member's role, remove a member, and revoke pending invites. The api is the real
// gate (WorkspaceGuard + @RequireOwner); this page reflects the same rules.
export function Members() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const isOwner = current?.role === Role.Owner;

  const [members, setMembers] = useState<MemberView[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilters, setRoleFilters] = useState<Role[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeSent, setUpgradeSent] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    setError(null);
    try {
      setMembers(await api<MemberView[]>(`/workspaces/${wsId}/members`));
      // Pending invites are an owner-only endpoint.
      setInvites(isOwner ? await api<Invite[]>(`/workspaces/${wsId}/invites`) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('members.error'));
    } finally {
      setLoading(false);
    }
  }, [wsId, isOwner, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!current) return <p className="empty">{t('members.loading')}</p>;

  // Personal workspaces: show the upgrade prompt instead of the members UI.
  if (current.type !== WorkspaceType.Team) {
    return (
      <div className="members">
        <header className="mem-head">
          <h1>{t('members.upgradeTitle')}</h1>
          <p>{t('members.upgradeBody')}</p>
        </header>

        {upgradeSent ? (
          <p className="members-ok" role="status" aria-live="polite">
            {t('members.upgradeSent')}
          </p>
        ) : (
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => setUpgradeOpen(true)}
          >
            {t('members.upgradeCta')}
          </button>
        )}

        {upgradeOpen && (
          <RequestTeamUpgradeModal
            workspaceId={current.id}
            onClose={() => setUpgradeOpen(false)}
            onSubmitted={() => {
              setUpgradeOpen(false);
              setUpgradeSent(true);
            }}
          />
        )}
      </div>
    );
  }

  const ql = q.trim().toLowerCase();
  const filtered = members.filter(
    (m) =>
      (!ql || m.name.toLowerCase().includes(ql) || m.email.toLowerCase().includes(ql)) &&
      (roleFilters.length === 0 || roleFilters.includes(m.role)),
  );

  return (
    <div className="members">
      <header className="mem-head">
        <h1>{t('members.title')}</h1>
        <p>{t('members.subtitle', { workspace: current.name })}</p>
      </header>

      <div className="lin-toolbar">
        <input
          className="lin-search"
          placeholder={t('members.searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('members.searchPlaceholder')}
        />
        <FilterPopover
          label={t('members.filter')}
          count={roleFilters.length}
          onClear={() => setRoleFilters([])}
        >
              <div className="lin-menu-label">{t('members.role')}</div>
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="lin-menu-item"
                  onClick={() => setRoleFilters((list) => toggleInList(list, r))}
                >
                  {ROLE_LABELS[r]}
                  {roleFilters.includes(r) && <span className="lin-menu-check">✓</span>}
                </button>
              ))}
        </FilterPopover>
        {isOwner && (
          <button
            type="button"
            className="lin-add"
            onClick={() => setInviteOpen((o) => !o)}
            title={t('members.invite')}
            aria-label={t('members.invite')}
          >
            <PlusIcon />
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty">{t('members.loading')}</p>
      ) : (
        <>
          {isOwner && inviteOpen && (
            <InviteForm wsId={wsId!} onInvited={load} onClose={() => setInviteOpen(false)} />
          )}

          <section aria-labelledby="mem-people-title">
            <h2 id="mem-people-title" className="mem-subhead">
              {t('members.peopleCount', { count: filtered.length })}
            </h2>
            {members.length === 0 ? (
              <EmptyState
                icon={<MembersIcon width={26} height={26} />}
                title={t('members.emptyTitle')}
                body={t('members.emptyBody')}
              />
            ) : filtered.length === 0 ? (
              <p className="empty">{t('members.noMatch')}</p>
            ) : (
              <div className="lib-grid">
                {filtered.map((m) => (
                  <MemberCard
                    key={m.membershipId}
                    member={m}
                    isSelf={m.userId === user?.id}
                    canManage={!!isOwner}
                    wsId={wsId!}
                    onChanged={load}
                    onError={setError}
                  />
                ))}
              </div>
            )}
          </section>

          {isOwner && invites.length > 0 && (
            <PendingInvites wsId={wsId!} invites={invites} onChanged={load} onError={setError} />
          )}
        </>
      )}
    </div>
  );
}

interface MemberCardProps {
  member: MemberView;
  isSelf: boolean;
  canManage: boolean;
  wsId: string;
  onChanged: () => Promise<void>;
  onError: Dispatch<SetStateAction<string | null>>;
}

function MemberCard({ member, isSelf, canManage, wsId, onChanged, onError }: MemberCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function changeRole(role: Role) {
    if (role === member.role) return;
    setBusy(true);
    onError(null);
    try {
      await api(`/workspaces/${wsId}/members/${member.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('members.error'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    onError(null);
    try {
      await api(`/workspaces/${wsId}/members/${member.userId}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('members.error'));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lib-card mem-card">
      <div className="lib-card-head">
        <span className="mem-id">
          <span className="mem-avatar" style={avatarStyle(member.name)} aria-hidden="true">
            {initial(member.name)}
          </span>
          <span className="mem-id-text">
            <span className="mem-name">
              {member.name}
              {isSelf && <span className="mem-you"> · {t('members.you')}</span>}
            </span>
            <span className="mem-email">{member.email}</span>
          </span>
        </span>
        <span className="badge mem-role">{ROLE_LABELS[member.role]}</span>
      </div>

      {canManage && (
        <div className="mem-actions">
          <label className="mem-role-pick">
            <span className="sr-only">{t('members.role')}</span>
            <select
              className="mem-select"
              value={member.role}
              disabled={busy}
              onChange={(e) => void changeRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <IconButton
            icon={<XIcon />}
            label={isSelf ? t('members.cantRemoveSelf') : t('members.remove')}
            variant="danger"
            disabled={busy || isSelf}
            onClick={() => setConfirm(true)}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={t('members.removeTitle')}
        message={
          <>
            {t('members.removeConfirm')} <strong>{member.name}</strong>?
          </>
        }
        confirmLabel={t('members.remove')}
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

function InviteForm({
  wsId,
  onInvited,
  onClose,
}: {
  wsId: string;
  onInvited: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.Member);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const res = await api<{ acceptUrl: string }>(`/workspaces/${wsId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      // No mailer is wired, so surface the accept link for the owner to share.
      // A registered invitee will also see it in their notification bell.
      setLink(res.acceptUrl);
      setEmail('');
      setRole(Role.Member);
      setCopied(false);
      await onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('members.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mem-invite" onSubmit={submit}>
      <div className="mem-invite-row">
        <input
          className="text-input mem-invite-email"
          type="email"
          placeholder={t('members.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <select className="mem-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? t('members.sending') : t('members.sendInvite')}
        </button>
        <button className="btn-ghost" type="button" onClick={onClose}>
          {t('members.cancel')}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {link && (
        <div className="mem-invite-link">
          <p className="mem-invite-sent">{t('members.inviteSent')}</p>
          <code className="mem-invite-url">{link}</code>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? t('members.copied') : t('members.copyLink')}
          </button>
        </div>
      )}
    </form>
  );
}

interface PendingInvitesProps {
  wsId: string;
  invites: Invite[];
  onChanged: () => Promise<void>;
  onError: Dispatch<SetStateAction<string | null>>;
}

function PendingInvites({ wsId, invites, onChanged, onError }: PendingInvitesProps) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusyId(id);
    onError(null);
    try {
      await api(`/workspaces/${wsId}/invites/${id}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('members.error'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="mem-invites-title">
      <h2 id="mem-invites-title" className="mem-subhead">
        {t('members.pendingCount', { count: invites.length })}
      </h2>
      <div className="lib-grid">
        {invites.map((inv) => (
          <div className="lib-card mem-card" key={inv.id}>
            <div className="lib-card-head">
              <span className="mem-id">
                <span className="mem-avatar mem-avatar-pending" aria-hidden="true">
                  @
                </span>
                <span className="mem-id-text">
                  <span className="mem-name">{inv.email}</span>
                  <span className="mem-email">{t('members.expires', { date: fmtDate(inv.expiresAt) })}</span>
                </span>
              </span>
              <span className="badge mem-role">{ROLE_LABELS[inv.role]}</span>
            </div>
            <div className="mem-actions">
              <IconButton
                icon={<XIcon />}
                label={t('members.revoke')}
                variant="danger"
                disabled={busyId === inv.id}
                onClick={() => void revoke(inv.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
