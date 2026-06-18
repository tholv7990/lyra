import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Channel } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import './connectors.css';

const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏',
};
const cls = (platform: string) => (GLYPH[platform] ? platform : 'generic');
const glyph = (platform: string) => GLYPH[platform] ?? '◆';

// Built-ins → Connections. Manage the Postiz API key + the channels connected
// through Postiz; Cobalt (media import) is an infra-level status. All calls go via
// the thin proxy (mock-backed until the microservice exists).
export function Connections() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setChannels((await connectorsApi.channels(ws)).channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const connect = () =>
    void act(async () => {
      const { url } = await connectorsApi.connectLink(ws!, 'postiz');
      window.open(url, '_blank', 'noopener');
    });

  const remove = (id: string) =>
    void act(async () => {
      await connectorsApi.removeChannel(ws!, id);
      await load();
    });

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.connectionsTitle')}</h2>
      <p className="cx-sub">{t('connectors.connectionsSubtitle')}</p>
      {error && <p className="cx-error">{error}</p>}

      <div className="cx-section">
        <div className="cx-sec-head">
          <span className="cx-sec-title">{t('connectors.publishing')}</span>
          <span className="cx-badge-ok">● Postiz {t('connectors.connected')}</span>
        </div>

        <div className="cx-keyrow">
          <label>{t('connectors.postizKey')}</label>
          <input
            className="cx-input"
            type="password"
            value={keyInput}
            placeholder="pos_…"
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button className="cx-btn" disabled={busy || !keyInput.trim()} onClick={saveKey}>
            {t('connectors.save')}
          </button>
        </div>

        <div className="cx-label">{t('connectors.connectedChannels')}</div>
        <div className="cx-grid">
          {channels.map((c) => (
            <div className="cx-card" key={c.id}>
              <span className={`cx-ic ${cls(c.platform)}`}>{glyph(c.platform)}</span>
              <div>
                <div className="cx-name">{c.displayName}</div>
                <div className="cx-plat">{c.platform}</div>
              </div>
              <button className="cx-x" title={t('connectors.remove')} disabled={busy} onClick={() => remove(c.id)}>
                ×
              </button>
            </div>
          ))}
          <button className="cx-add" disabled={busy} onClick={connect}>
            ＋ {t('connectors.connectChannel')}
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
