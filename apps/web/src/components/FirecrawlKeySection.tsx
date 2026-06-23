import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectorCredentialInfo } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import '../pages/connectors.css';

// The Firecrawl key (optional robust-fetch backend for bot-blocked marketplace pages).
// Stored encrypted per workspace; never returned in full.
export function FirecrawlKeySection() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;
  const [cred, setCred] = useState<ConnectorCredentialInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setCred(await connectorsApi.firecrawlStatus(ws));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!ws || !keyInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await connectorsApi.saveCredential(ws, 'firecrawl', keyInput.trim());
      setKeyInput('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="set-section">
      <div className="set-section-head">
        <h2>{t('connectors.firecrawl')}</h2>
        <p>{t('connectors.firecrawlKeyHint')}</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="set-keyrow">
        <input
          className="text-input"
          type="password"
          placeholder={t('connectors.firecrawlKey')}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <button type="button" className="btn-primary" style={{ width: 'auto' }} disabled={busy || !keyInput.trim()} onClick={() => void save()}>
          {t('connectors.save')}
        </button>
      </div>
      <p className={cred?.connected ? 'cx-badge-ok' : 'cx-badge-off'}>
        ● Firecrawl {cred?.connected ? `${t('connectors.connected')} ····${cred.last4 ?? ''}` : t('connectors.notConnected')}
      </p>
    </section>
  );
}
