import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequestType, type UserRequest } from '@lyra/shared';
import { api } from '../lib/api';
import { Modal } from './Modal';
import { IconButton } from './IconButton';
import { XIcon } from '../layout/icons';

// "Request a provider" — a signed-in user asks the admins to add a provider the
// catalog doesn't list yet. Submits as a generic UserRequest (type: provider).
export function RequestProviderModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function submit() {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api<UserRequest>('/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: RequestType.Provider,
          subject: trimmed,
          body: note.trim() || undefined,
        }),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.requestFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <IconButton
          className="dialog-close"
          icon={<XIcon width={15} height={15} />}
          label={t('common.close')}
          size="sm"
          onClick={onClose}
        />
        <h3>{t('settings.requestProviderTitle')}</h3>
        <p>{t('settings.requestProviderSub')}</p>
        {error && <p className="error">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span>{t('settings.requestProviderNameLabel')}</span>
            <input
              className="text-input"
              autoFocus
              placeholder={t('settings.requestProviderName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('settings.requestProviderNoteLabel')}</span>
            <textarea
              className="text-input req-note"
              rows={3}
              placeholder={t('settings.requestProviderNote')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('settings.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary btn-inline"
              disabled={busy || !trimmed}
            >
              {busy ? t('settings.requestSending') : t('settings.requestSend')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
