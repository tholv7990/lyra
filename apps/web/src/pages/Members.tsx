import { useCallback, useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Role, WorkspaceType } from '@lyra/shared';
import type { Invite, MemberView } from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { api } from '../lib/api';
import { initial, avatarStyle, fmtDate } from '../lib/format';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';
import { toggleInList } from '../lib/array';
import { ROLE_LABELS } from '../lib/constants';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconButton } from '../components/IconButton';
import { FilterPopover } from '../components/FilterPopover';
import { MenuPicker } from '../components/MenuPicker';
import { RequestTeamUpgradeModal } from '../components/RequestTeamUpgradeModal';
import { KeyIcon, MembersIcon, PersonIcon, PlusIcon, PromptsIcon, XIcon } from '../layout/icons';
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

  // Personal workspaces: show the hero upgrade gate instead of the members UI.
  if (current.type !== WorkspaceType.Team) {
    return (
      <div className="members">
        <SoloUpgradeHero
          upgradeSent={upgradeSent}
          onUpgradeClick={() => setUpgradeOpen(true)}
        />
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
          <span className="mem-role-pick">
            <MenuPicker<Role>
              value={member.role}
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              onChange={(v) => void changeRole(v)}
              disabled={busy}
              ariaLabel={t('members.role')}
            />
          </span>
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
  const { copied, copy } = useCopyToClipboard();

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
        <MenuPicker<Role>
          value={role}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          onChange={(v) => setRole(v)}
          ariaLabel={t('members.role')}
        />
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
            onClick={() => copy(link)}
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

// ---------------------------------------------------------------------------
// SoloUpgradeHero — shown when WorkspaceType !== Team.
// Structure mirrors the mockup (Lyra Members.dc.html): hero card with avatar
// roster + gradient wash, perk grid, current-plan strip. Colors are strictly
// from `:root` tokens; no hardcodes.
// ---------------------------------------------------------------------------

// Static roster initials used in the hero avatar strip — purely decorative.
const ROSTER_AVATARS = [
  { initials: 'JD', accentVar: '--accent-projects' },
  { initials: 'MK', accentVar: '--accent-prompts' },
  { initials: 'AR', accentVar: '--accent-members' },
  { initials: 'SL', accentVar: '--accent-keys' },
  { initials: 'TN', accentVar: '--accent-pipelines' },
] as const;

interface SoloUpgradeHeroProps {
  upgradeSent: boolean;
  onUpgradeClick: () => void;
}

function SoloUpgradeHero({ upgradeSent, onUpgradeClick }: SoloUpgradeHeroProps) {
  const { t } = useTranslation();

  return (
    <div className="mem-solo-root">
      {/* ── Hero card ─────────────────────────────────────────────────── */}
      <div className="mem-hero-card">
        {/* Gradient wash at the top — uses primary tint, fades to transparent */}
        <div className="mem-hero-gradient" aria-hidden="true" />

        <div className="mem-hero-body">
          {/* Overlapping avatar roster */}
          <div className="mem-hero-roster" aria-hidden="true">
            {ROSTER_AVATARS.map((a) => (
              <span
                key={a.initials}
                className="mem-hero-avatar"
                style={{ background: `var(${a.accentVar})` }}
              >
                {a.initials}
              </span>
            ))}
            {/* Dashed "+" placeholder slot */}
            <span className="mem-hero-avatar mem-hero-avatar-plus">+</span>
          </div>

          {/* "Team workspace" badge */}
          <div className="mem-hero-badge">
            <MembersIcon width={12} height={12} aria-hidden="true" />
            {t('members.heroTeamBadge')}
          </div>

          <h1 className="mem-hero-title">{t('members.heroTitle')}</h1>
          <HeroDesc />

          {/* CTAs */}
          {upgradeSent ? (
            <p className="members-ok" role="status" aria-live="polite">
              {t('members.upgradeSent')}
            </p>
          ) : (
            <div className="mem-hero-ctas">
              <button
                type="button"
                className="btn-primary btn-inline mem-hero-cta-primary"
                onClick={onUpgradeClick}
              >
                <PlusIcon aria-hidden="true" />
                {t('members.upgradeCta')}
              </button>
              <button type="button" className="btn-ghost btn-inline mem-hero-cta-secondary">
                {t('members.heroComparePlans')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── "What you unlock" perk grid ───────────────────────────────── */}
      <div className="mem-perks-section">
        <div className="mem-perks-label">{t('members.heroUnlocksLabel')}</div>
        <div className="mem-perks-grid">
          <PerkCard
            iconEl={<MembersIcon width={17} height={17} aria-hidden="true" />}
            accentVar="--accent-members"
            title={t('members.perkInviteTitle')}
            desc={t('members.perkInviteDesc')}
          />
          <PerkCard
            iconEl={<ShieldGlyph />}
            accentVar="--accent-keys"
            title={t('members.perkRolesTitle')}
            desc={t('members.perkRolesDesc')}
          />
          <PerkCard
            iconEl={<PromptsIcon width={17} height={17} aria-hidden="true" />}
            accentVar="--accent-prompts"
            title={t('members.perkSharedTitle')}
            desc={t('members.perkSharedDesc')}
          />
          <PerkCard
            iconEl={<KeyIcon width={17} height={17} aria-hidden="true" />}
            accentVar="--primary"
            title={t('members.perkKeysTitle')}
            desc={t('members.perkKeysDesc')}
          />
        </div>
      </div>

      {/* ── Current plan strip ────────────────────────────────────────── */}
      <div className="mem-plan-strip">
        <div className="mem-plan-left">
          <span className="mem-plan-icon" aria-hidden="true">
            <PersonIcon width={18} height={18} />
          </span>
          <div>
            <div className="mem-plan-name">{t('members.heroPlanLabel')}</div>
            <div className="mem-plan-sub">{t('members.heroPlanSub')}</div>
          </div>
        </div>
        <a href="mailto:sales@lyra.app" className="mem-plan-sales">
          {t('members.heroTalkSales')}
          <ArrowRightGlyph />
        </a>
      </div>
    </div>
  );
}

// Renders the hero description with the "solo" word as an inline chip.
function HeroDesc() {
  const { t } = useTranslation();
  const raw = t('members.heroBody');
  const solo = t('members.heroSoloBadge');
  const idx = raw.indexOf(solo);
  if (idx === -1) return <p className="mem-hero-desc">{raw}</p>;
  return (
    <p className="mem-hero-desc">
      {raw.slice(0, idx)}
      <span className="mem-solo-chip">{solo}</span>
      {raw.slice(idx + solo.length)}
    </p>
  );
}

// Perk feature card inside the unlock grid.
function PerkCard({
  iconEl,
  accentVar,
  title,
  desc,
}: {
  iconEl: ReactNode;
  accentVar: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="mem-perk-card">
      <span
        className="mem-perk-icon"
        style={{
          background: `color-mix(in srgb, var(${accentVar}) 14%, transparent)`,
          color: `var(${accentVar})`,
        }}
        aria-hidden="true"
      >
        {iconEl}
      </span>
      <div className="mem-perk-text">
        <div className="mem-perk-title">{title}</div>
        <div className="mem-perk-desc">{desc}</div>
      </div>
    </div>
  );
}

// Inline shield glyph for the Roles & permissions perk.
function ShieldGlyph() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.8 13 4v3.4c0 3.2-2.1 5.4-5 6.8-2.9-1.4-5-3.6-5-6.8V4Z" />
      <path d="m6.2 7.8 1.3 1.3 2.5-2.6" />
    </svg>
  );
}

// Inline right-arrow glyph for the "Talk to sales" link.
function ArrowRightGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 8h9M8.5 4l4 4-4 4" />
    </svg>
  );
}
