import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequestType, type UserRequest } from '@lyra/shared';
import { api } from '../lib/api';
import { useEscapeKey } from '../lib/useEscapeKey';
import { IconButton } from './IconButton';
import { XIcon } from '../layout/icons';

// "Request a team upgrade" — the owner of a personal workspace asks the admins
// to upgrade it to a team workspace. Mirrors RequestProviderModal structure.
export function RequestTeamUpgradeModal({
  workspaceId,
  onClose,
  onSubmitted,
}: {
  workspaceId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  useEscapeKey(onClose);

  async function submit() {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api<UserRequest>('/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: RequestType.TeamUpgrade,
          subject: trimmed,
          body: note.trim() || undefined,
          workspaceId,
        }),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('members.upgradeFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <IconButton
          className="dialog-close"
          icon={<XIcon width={15} height={15} />}
          label={t('common.close')}
          size="sm"
          onClick={onClose}
        />
        <h3>{t('members.upgradeModalTitle')}</h3>
        <p>{t('members.upgradeModalSub')}</p>
        {error && <p className="error">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span>{t('members.upgradeNameLabel')}</span>
            <input
              className="text-input"
              autoFocus
              placeholder={t('members.upgradeNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('members.upgradeNoteLabel')}</span>
            <textarea
              className="text-input req-note"
              rows={3}
              placeholder={t('members.upgradeNotePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('members.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary btn-inline"
              disabled={busy || !trimmed}
            >
              {busy ? t('members.upgradeSending') : t('members.upgradeSend')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
