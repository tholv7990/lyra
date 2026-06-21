import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectorCredentialInfo } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import '../pages/connectors.css';

// The Postiz API key (powers Postiz-type channels). Lives in Settings; the key is
// stored encrypted per workspace and never returned in full.
export function PostizKeySection() {
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
      setCred(await connectorsApi.credentialStatus(ws));
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
      await connectorsApi.saveCredential(ws, 'postiz', keyInput.trim());
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
        <h2>{t('connectors.publishing')}</h2>
        <p>{t('connectors.postizKeyHint')}</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="set-keyrow">
        <input
          className="text-input"
          type="password"
          placeholder={t('connectors.postizKey')}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <button type="button" className="btn-primary" style={{ width: 'auto' }} disabled={busy || !keyInput.trim()} onClick={() => void save()}>
          {t('connectors.save')}
        </button>
      </div>
      <p className={cred?.connected ? 'cx-badge-ok' : 'cx-badge-off'}>
        ● Postiz {cred?.connected ? `${t('connectors.connected')} ····${cred.last4 ?? ''}` : t('connectors.notConnected')}
      </p>
    </section>
  );
}
