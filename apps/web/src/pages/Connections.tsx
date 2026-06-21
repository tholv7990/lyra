import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChannelType, type Channel, type ConnectorCredentialInfo } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import { channelsApi } from '../lib/channels';
import { PlatformSelect } from '../components/PlatformSelect';
import { GologinMark } from '../components/GologinMark';
import { PublishIcon } from '../layout/icons';
import './connectors.css';

const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏', bluesky: '🦋', mastodon: '🐘',
};
const cls = (platform: string) => (GLYPH[platform] ? platform : 'generic');
const glyph = (platform: string) => GLYPH[platform] ?? '◆';
const emptyForm = { platform: 'tiktok', displayName: '', profileId: '', proxy: '' };

// Built-ins → Connections. The workspace's unified channel list: Postiz accounts
// (auto-imported from the pool) + GoLogin channels (added here). Plus the Postiz API key.
export function Connections() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [cred, setCred] = useState<ConnectorCredentialInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setCred(await connectorsApi.credentialStatus(ws));
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

  const saveKey = () =>
    void act(async () => {
      await connectorsApi.saveCredential(ws!, 'postiz', keyInput.trim());
      setKeyInput('');
      await load();
    });

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
      setForm(emptyForm);
      setAddOpen(false);
      await load();
    });

  const removeChannel = (c: Channel) => void act(async () => { await channelsApi.remove(ws!, c.id); await load(); });

  const canAdd = !!form.displayName.trim() && !!form.profileId.trim();

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.connectionsTitle')}</h2>
      <p className="cx-sub">{t('connectors.connectionsSubtitle')}</p>
      {error && <p className="cx-error">{error}</p>}

      <div className="cx-section">
        <div className="cx-sec-head">
          <span className="cx-sec-title">{t('connectors.publishing')}</span>
          <span className={cred?.connected ? 'cx-badge-ok' : 'cx-badge-off'}>
            ● Postiz{' '}
            {cred?.connected
              ? `${t('connectors.connected')} ····${cred.last4 ?? ''}`
              : t('connectors.notConnected')}
          </span>
        </div>

        <div className="cx-keyrow">
          <label>{t('connectors.postizKey')}</label>
          <input
            className="cx-input"
            type="password"
            value={keyInput}
            placeholder="postiz key…"
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button className="cx-btn" disabled={busy || !keyInput.trim()} onClick={saveKey}>
            {t('connectors.save')}
          </button>
        </div>
        <p className="cx-note">{t('connectors.postizKeyHint')}</p>

        <div className="cx-label">{t('connectors.connectedChannels')}</div>
        <div className="cx-grid">
          {channels.map((c) => (
            <div className="cx-card" key={c.id}>
              <span className={`cx-ic ${cls(c.platform)}`}>{glyph(c.platform)}</span>
              <div className="cx-card-id">
                <div className="cx-name">{c.displayName}</div>
                <div className="cx-plat">
                  {c.platform}
                  <span className={`cx-type cx-type-${c.type}`}>
                    {c.type === ChannelType.GoLogin ? <GologinMark size={11} /> : <PublishIcon width={11} height={11} />}
                    {c.type === ChannelType.GoLogin ? t('connectors.viaGoLogin') : t('connectors.viaPostiz')}
                  </span>
                </div>
              </div>
              {c.type === ChannelType.GoLogin && (
                <button className="cx-del" title={t('connectors.removeChannel')} aria-label={t('connectors.removeChannel')} disabled={busy} onClick={() => removeChannel(c)}>×</button>
              )}
            </div>
          ))}
          <button className="cx-add" disabled={busy} onClick={openPostiz}>
            ＋ {t('connectors.manageInPostiz')} ↗
          </button>
          <button className="cx-add" disabled={busy} onClick={() => setAddOpen((o) => !o)}>
            ＋ {t('connectors.addGoLoginChannel')}
          </button>
        </div>

        {addOpen && (
          <div className="cx-addform">
            <div className="cx-field">
              <span id="cx-plat-label">{t('connectors.channelPlatform')}</span>
              <PlatformSelect value={form.platform} onChange={(platform) => setForm({ ...form, platform })} labelledBy="cx-plat-label" />
            </div>
            <label className="cx-field">
              <span>{t('connectors.channelDisplayName')}</span>
              <input className="cx-input" value={form.displayName} placeholder="@handle" onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </label>
            <label className="cx-field">
              <span>{t('connectors.gologinProfileId')}</span>
              <input className="cx-input" value={form.profileId} placeholder="6a33…" onChange={(e) => setForm({ ...form, profileId: e.target.value })} />
            </label>
            <label className="cx-field">
              <span>{t('connectors.gologinProxy')}</span>
              <input className="cx-input" value={form.proxy} placeholder="optional" onChange={(e) => setForm({ ...form, proxy: e.target.value })} />
            </label>
            <button className="cx-btn" disabled={busy || !canAdd} onClick={addChannel}>{t('connectors.addChannelBtn')}</button>
          </div>
        )}
      </div>

      <div className="cx-section">
        <div className="cx-sec-head">
          <span className="cx-sec-title">{t('connectors.mediaImport')}</span>
          <span className="cx-badge-ok">● {t('connectors.connected')}</span>
        </div>
        <p className="cx-note">{t('connectors.cobaltNote')}</p>
      </div>
    </div>
  );
}
