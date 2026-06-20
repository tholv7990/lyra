import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProviderCatalogEntry } from '../lib/providerCatalog';
import { ProviderBadge } from './ProviderBadge';

// The single add/replace-key surface: pick a provider in the Settings dropdown,
// click Add, paste the key here, Save. Replacing an existing key reopens this
// same modal. The key is write-only — it goes straight to the api, never read back.
export function AddKeyModal({
  entry,
  replace,
  busy,
  error,
  onSave,
  onClose,
}: {
  entry: ProviderCatalogEntry;
  replace: boolean;
  busy: boolean;
  error: string | null;
  onSave: (key: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const trimmed = key.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head-icon">
          <ProviderBadge entry={entry} size={28} />
          <h3>{t(replace ? 'settings.replaceKeyHeading' : 'settings.addKeyHeading', { provider: entry.label })}</h3>
        </div>
        <p>{t('settings.addKeySub')}</p>
        {error && <p className="error">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !busy) onSave(trimmed);
          }}
        >
          <div className="field">
            <span>{t('settings.apiKeyLabel')}</span>
            <input
              className="text-input"
              type="password"
              autoFocus
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              aria-label={t('settings.apiKeyLabel')}
              placeholder={t('settings.pasteKey')}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            {entry.keyUrl && (
              <a className="add-key-link" href={entry.keyUrl} target="_blank" rel="noreferrer">
                {t('settings.getKey')} ↗
              </a>
            )}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('settings.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto', marginTop: 0 }}
              disabled={busy || !trimmed}
            >
              {busy ? t('settings.savingKey') : t('settings.saveKey')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
