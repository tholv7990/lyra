import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryKind } from '@lyra/shared';
import { api } from '../lib/api';
import { Modal } from './Modal';
import { MenuPicker, type MenuPickerOption } from './MenuPicker';

interface Props {
  wsId: string;
  /** The message text to remember. */
  content: string;
  onClose: () => void;
  onSaved?: () => void;
}

// Build the kind options once; labels come from i18n via the t() call below.
const KIND_VALUES = Object.values(MemoryKind) as MemoryKind[];

// Save a chat message as an assistant memory entry.
export function RememberModal({ wsId, content, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(content);
  const [kind, setKind] = useState<MemoryKind>(MemoryKind.Fact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindOptions: MenuPickerOption<MemoryKind>[] = KIND_VALUES.map((k) => ({
    value: k,
    label: t(`memory.kind.${k}`),
  }));

  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/workspaces/${wsId}/memory`, {
        method: 'POST',
        body: JSON.stringify({ kind, text: text.trim() }),
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('memory.save'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="rmem">
      <h3>{t('memory.title')}</h3>
      {error && <p className="error">{error}</p>}

      <label className="field">
        <span>{t('memory.title')}</span>
        <textarea
          className="text-input rmem-body"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </label>

      <div className="field">
        <MenuPicker<MemoryKind>
          value={kind}
          options={kindOptions}
          onChange={setKind}
          ariaLabel={t('memory.title')}
        />
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn-primary btn-inline"
          disabled={busy || !text.trim()}
          onClick={() => void save()}
        >
          {busy ? t('common.saving') : t('memory.save')}
        </button>
      </div>
    </Modal>
  );
}
