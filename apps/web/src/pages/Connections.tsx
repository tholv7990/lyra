import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChannelType, type Channel } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { channelsApi } from '../lib/channels';
import { platformColor, platformLabel } from '../lib/platform';
import { groupChannels, shortProfileId, type Connection } from '../lib/connections';
import { Modal } from '../components/Modal';
import { Field } from '../components/Field';
import { PlatformSelect } from '../components/PlatformSelect';
import { ConnectionsIcon, ImportIcon, MembersIcon, ComponentsIcon, PlusIcon, TrashIcon, XIcon } from '../layout/icons';
import './connectors.css';

const emptyForm = { platform: 'tiktok', displayName: '', profileId: '', proxy: '' };

// ── helpers ────────────────────────────────────────────────────────────────────

/** Derive a tinted icon square bg from a token name via color-mix. */
function tokenTint(token: string, pct = 14) {
  return `color-mix(in srgb, ${token} ${pct}%, transparent)`;
}

interface ProviderMeta {
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

const PROVIDER_META: Record<ChannelType, ProviderMeta> = {
  [ChannelType.GoLogin]: {
    iconBg: tokenTint('var(--accent-keys)'),
    iconColor: 'var(--accent-keys)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 3.2h2a1.2 1.2 0 0 1 1.2 1.2v7.2a1.2 1.2 0 0 1-1.2 1.2h-2" />
        <path d="M3.3 8h6.4M7.2 5.5 9.7 8l-2.5 2.5" />
      </svg>
    ),
  },
  [ChannelType.Postiz]: {
    iconBg: tokenTint('var(--accent-publish)'),
    iconColor: 'var(--accent-publish)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.6 2.4 7.2 8.8M13.6 2.4l-4 11.2-2.4-4.8-4.8-2.4Z" />
      </svg>
    ),
  },
};

// ── stat strip ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, iconBg, iconColor, icon }: StatCardProps) {
  return (
    <div className="cxv2-stat-card">
      <div className="cxv2-stat-head">
        <span className="cxv2-stat-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="cxv2-stat-label">{label}</span>
      </div>
      <div className="cxv2-stat-value">{value}</div>
    </div>
  );
}

// ── platform dot chip ─────────────────────────────────────────────────────────

function PlatformChip({ platform }: { platform: string }) {
  const color = platformColor(platform);
  const label = platformLabel(platform);
  return (
    <span className="cxv2-plat-chip">
      <span className="cxv2-plat-dot" style={{ background: color }} />
      {label}
    </span>
  );
}

// ── connection block (one card per connection) ─────────────────────────────────

interface ConnectionBlockProps {
  conn: Connection;
  busy: boolean;
  onAddAccount: (profileId: string) => void;
  onRemove: (c: Channel) => void;
  onConnect: () => void;
}

function ConnectionBlock({ conn, busy, onAddAccount, onRemove, onConnect }: ConnectionBlockProps) {
  const { t } = useTranslation();
  const meta = PROVIDER_META[conn.connector];

  return (
    <div className="cxv2-provider-card">
      {/* connection header */}
      <div className="cxv2-provider-head">
        <span className="cxv2-provider-icon" style={{ background: meta.iconBg, color: meta.iconColor }}>
          {meta.icon}
        </span>
        <div className="cxv2-provider-info">
          <div className="cxv2-provider-name-row">
            {conn.connector === ChannelType.GoLogin ? (
              <span className="cxv2-provider-name">
                {t('connectors.browserProfile')}
                {conn.profileId && (
                  <span className="cxv2-profile-chip">{shortProfileId(conn.profileId)}</span>
                )}
                {conn.proxy && (
                  <span className="cxv2-profile-chip cxv2-proxy-chip">
                    {`${t('connectors.proxyLabel')} · ${conn.proxy}`}
                  </span>
                )}
              </span>
            ) : (
              <span className="cxv2-provider-name">{t('connectors.postizPool')}</span>
            )}
            {conn.accounts.length > 0 && (
              <span className="cxv2-status-pill cxv2-status-ok">
                <span className="cxv2-status-dot" />
                {t('connectors.connected')}
              </span>
            )}
          </div>
          <div className="cxv2-provider-desc">
            {conn.accounts.length} {t('connectors.accountsSuffix')}
          </div>
        </div>
        {conn.connector === ChannelType.GoLogin ? (
          <button
            type="button"
            className="cxv2-add-btn"
            onClick={() => onAddAccount(conn.profileId!)}
            disabled={busy}
          >
            <PlusIcon width={13} height={13} />
            {t('connectors.addAccount')}
          </button>
        ) : (
          <button
            type="button"
            className="cxv2-add-btn"
            onClick={onConnect}
            disabled={busy}
          >
            <PlusIcon width={13} height={13} />
            {t('connectors.manageInPostiz')}
          </button>
        )}
        {/* 3-dot menu placeholder — no-op in v1, matches mockup structure */}
        <button
          type="button"
          className="cxv2-more-btn"
          aria-label={t('connectors.providerOptions')}
          title={t('connectors.providerOptions')}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="3.5" r="1.2" />
            <circle cx="8" cy="12.5" r="1.2" />
          </svg>
        </button>
      </div>

      {/* column headers — only show when there are accounts */}
      {conn.accounts.length > 0 && (
        <div className="cxv2-col-head">
          <div className="cxv2-col-labels">
            <span>{t('connectors.colAccount')}</span>
            <span>{t('connectors.colPlatforms')}</span>
          </div>
          <span />
        </div>
      )}

      {/* account rows */}
      {conn.accounts.length === 0 ? (
        <div className="cxv2-provider-empty">
          {conn.connector === ChannelType.GoLogin
            ? t('connectors.noChannelsYet')
            : t('connectors.postizAutoNote')}
        </div>
      ) : (
        conn.accounts.map((c) => (
          <div key={c.id} className="cxv2-channel-row">
            {/* inner two-column: [avatar+name | platforms] */}
            <div className="cxv2-channel-inner">
              <div className="cxv2-channel-avatar-wrap">
                <span className="cxv2-channel-avatar">
                  {c.displayName.trim().charAt(0).toUpperCase()}
                </span>
                <div className="cxv2-channel-name-col">
                  <div className="cxv2-channel-name" title={c.displayName}>
                    {c.displayName}
                  </div>
                  <div className="cxv2-status-dot-row">
                    <span className="cxv2-status-dot cxv2-status-dot-sm" />
                    <span className="cxv2-channel-status-label">{t('connectors.connected')}</span>
                  </div>
                </div>
              </div>
              {/* platform chip — current model: one channel = one platform */}
              <div className="cxv2-channel-platforms">
                <PlatformChip platform={c.platform} />
              </div>
            </div>
            {c.type === ChannelType.GoLogin ? (
              <button
                type="button"
                className="cxv2-row-del"
                onClick={() => onRemove(c)}
                disabled={busy}
                title={t('connectors.removeChannel')}
                aria-label={t('connectors.removeChannel')}
              >
                <TrashIcon width={14} height={14} />
              </button>
            ) : (
              /* Postiz channels managed in Postiz — spacer keeps grid alignment */
              <span className="cxv2-row-spacer" aria-hidden="true" />
            )}
          </div>
        ))
      )}

      {/* Mobile-only bottom "Add" button (mimics mockup full-width strip) */}
      {conn.connector === ChannelType.GoLogin && (
        <button
          type="button"
          className="cxv2-provider-add-strip"
          onClick={() => onAddAccount(conn.profileId!)}
          disabled={busy}
        >
          <PlusIcon width={13} height={13} />
          {t('connectors.addAccount')}
        </button>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function Connections() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lockedProfile, setLockedProfile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setChannels(await channelsApi.list(ws));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);

  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<unknown>) {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    } finally {
      setBusy(false);
    }
  }

  /** Open modal for a brand-new connection (no profileId prefilled). */
  const openAdd = () => { setForm(emptyForm); setLockedProfile(null); setError(null); setAddOpen(true); };

  /** Open modal to add an account to an existing GoLogin profile (profileId locked). */
  const openAddAccount = (profileId: string) => {
    setForm({ ...emptyForm, profileId });
    setLockedProfile(profileId);
    setError(null);
    setAddOpen(true);
  };

  const openPostiz = () =>
    void act(async () => {
      const { url } = await connectorsApi.connectLink(ws!, 'postiz');
      window.open(url, '_blank', 'noopener');
    });

  const addChannel = () =>
    void act(async () => {
      await channelsApi.create(ws!, {
        platform: form.platform,
        displayName: form.displayName.trim(),
        profileId: form.profileId.trim(),
        ...(form.proxy.trim() ? { proxy: form.proxy.trim() } : {}),
      });
      setLockedProfile(null);
      setAddOpen(false);
      await load();
    });

  const removeChannel = (c: Channel) =>
    void act(async () => { await channelsApi.remove(ws!, c.id); await load(); });

  const canAdd = !!form.displayName.trim() && !!form.profileId.trim();

  // ── derived ──────────────────────────────────────────────────────────────
  const connections = groupChannels(channels);
  const totalChannels = channels.length;
  const distinctPlatforms = new Set(channels.map((c) => c.platform)).size;

  return (
    <div className="cxv2-page">
      {/* ── page title ── */}
      <div className="cxv2-title-block">
        <h1 className="cxv2-h1">{t('connectors.connectionsTitle')}</h1>
        <p className="cxv2-subtitle">{t('connectors.connectionsSubtitleV2')}</p>
      </div>

      {/* ── stat strip ── */}
      <div className="cxv2-stat-strip">
        <StatCard
          label={t('connectors.statConnections')}
          value={connections.length}
          iconBg={tokenTint('var(--primary)', 13)}
          iconColor="var(--primary)"
          icon={<ConnectionsIcon width={15} height={15} />}
        />
        <StatCard
          label={t('connectors.statAccounts')}
          value={totalChannels}
          iconBg={tokenTint('var(--accent-projects)', 14)}
          iconColor="var(--accent-projects)"
          icon={<MembersIcon width={15} height={15} />}
        />
        <StatCard
          label={t('connectors.statPlatforms')}
          value={distinctPlatforms}
          iconBg={tokenTint('var(--accent-publish)', 14)}
          iconColor="var(--accent-publish)"
          icon={<ComponentsIcon width={15} height={15} />}
        />
      </div>

      {error && !addOpen && <p className="cx-error">{error}</p>}

      {/* ── provider blocks ── */}
      <div className="cxv2-providers">
        {/* "+ New connection" button — always visible so empty workspaces can create the first profile */}
        <div className="cxv2-providers-header">
          <button
            type="button"
            className="cxv2-add-btn"
            onClick={openAdd}
            disabled={busy}
          >
            <PlusIcon width={13} height={13} />
            {t('connectors.newConnection')}
          </button>
        </div>

        {/* one card per connection (GoLogin per-profile + Postiz pool when present) */}
        {connections.map((conn) => (
          <ConnectionBlock
            key={conn.key}
            conn={conn}
            busy={busy}
            onAddAccount={openAddAccount}
            onRemove={removeChannel}
            onConnect={openPostiz}
          />
        ))}
      </div>

      {/* ── services strip ── */}
      <div className="cxv2-services">
        <div className="cxv2-services-label">{t('connectors.servicesLabel')}</div>
        <div className="cxv2-service-row">
          <span
            className="cxv2-provider-icon"
            style={{
              background: tokenTint('var(--accent-import)', 14),
              color: 'var(--accent-import)',
            }}
          >
            <ImportIcon width={19} height={19} />
          </span>
          <div className="cxv2-service-info">
            <div className="cxv2-service-name-row">
              <span className="cxv2-service-name">{t('connectors.mediaImport')}</span>
              <span className="cxv2-status-pill cxv2-status-ok">
                <span className="cxv2-status-dot" />
                {t('connectors.connected')}
              </span>
            </div>
            <p className="cxv2-service-note">
              {t('connectors.cobaltNoteV2')}
            </p>
          </div>
          <span className="cxv2-ws-badge">{t('connectors.workspaceLevel')}</span>
        </div>
      </div>

      {/* ── add-channel modal (GoLogin only) ── */}
      {addOpen && (
        <Modal onClose={() => { setLockedProfile(null); setAddOpen(false); }} className="cx-add-modal">
          <div className="cx-modal-head">
            <h3>{lockedProfile ? t('connectors.addAccountTitle') : t('connectors.addChannelTitle')}</h3>
            <button
              type="button"
              className="cx-modal-x"
              onClick={() => { setLockedProfile(null); setAddOpen(false); }}
              aria-label={t('common.close')}
            >
              <XIcon />
            </button>
          </div>
          <div className="cx-modal-body">
            <div className="field">
              <span id="m-plat">{t('connectors.channelPlatform')}</span>
              <PlatformSelect
                value={form.platform}
                onChange={(platform) => setForm({ ...form, platform })}
                labelledBy="m-plat"
              />
            </div>
            <Field label={t('connectors.channelDisplayName')}>
              <input
                className="text-input"
                value={form.displayName}
                placeholder="@handle"
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </Field>
            <Field label={t('connectors.gologinProfileId')}>
              <input
                className={`text-input${lockedProfile ? ' text-input--readonly' : ''}`}
                value={form.profileId}
                placeholder="6a33…"
                readOnly={!!lockedProfile}
                disabled={!!lockedProfile}
                onChange={lockedProfile ? undefined : (e) => setForm({ ...form, profileId: e.target.value })}
              />
            </Field>
            <Field label={t('connectors.gologinProxy')}>
              <input
                className="text-input"
                value={form.proxy}
                placeholder="optional"
                onChange={(e) => setForm({ ...form, proxy: e.target.value })}
              />
            </Field>
            {error && <p className="cx-error">{error}</p>}
            <div className="cx-modal-actions">
              <button
                type="button"
                className="btn-ghost btn-inline"
                onClick={() => { setLockedProfile(null); setAddOpen(false); }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary btn-inline"
                disabled={busy || !canAdd}
                onClick={addChannel}
              >
                {lockedProfile ? t('connectors.addAccount') : t('connectors.addChannelBtn')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
