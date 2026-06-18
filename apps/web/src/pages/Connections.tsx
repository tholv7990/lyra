import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Channel, ConnectorCredentialInfo } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import './connectors.css';

const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏', bluesky: '🦋', mastodon: '🐘',
};
const cls = (platform: string) => (GLYPH[platform] ? platform : 'generic');
const glyph = (platform: string) => GLYPH[platform] ?? '◆';

// Built-ins → Connections. Manage the Postiz API key (stored encrypted, per
// workspace) and view the channels connected in Postiz. Connecting/removing
// channels happens in the Postiz UI (its public API can't), so we link out.
export function Connections() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [cred, setCred] = useState<ConnectorCredentialInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setCred(await connectorsApi.credentialStatus(ws));
      setChannels((await connectorsApi.channels(ws)).channels);
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
              <div>
                <div className="cx-name">{c.displayName}</div>
                <div className="cx-plat">{c.platform}</div>
              </div>
            </div>
          ))}
          <button className="cx-add" disabled={busy} onClick={openPostiz}>
            ＋ {t('connectors.manageInPostiz')} ↗
          </button>
        </div>
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
