import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PromptStatus,
  type LabelInfo,
  type Prompt,
  type PromptMedia,
  type Provider,
} from '@lyra/shared';
import { api } from '../lib/api';
import { LabelPicker } from './LabelPicker';
import { Modal } from './Modal';
import { Toggle } from './Toggle';

interface Props {
  wsId: string;
  /** The message text to promote into a library prompt. */
  content: string;
  media?: PromptMedia[];
  provider: Provider;
  model: string;
  labels: LabelInfo[];
  onCreateLabel: (name: string, color: string) => Promise<LabelInfo | null>;
  onClose: () => void;
  onSaved: (prompt: Prompt) => void;
}

// Promote a chat message into the prompt library. Prefilled with the message
// text + the provider·model it ran on (so the saved prompt remembers them).
export function SaveAsPromptModal({
  wsId,
  content,
  media,
  provider,
  model,
  labels,
  onCreateLabel,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(content);
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const prompt = await api<Prompt>(`/workspaces/${wsId}/prompts`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: body,
          status: isPublic ? PromptStatus.Public : PromptStatus.Draft,
          tags,
          media: media ?? [],
          provider,
          model,
        }),
      });
      onSaved(prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('prompts.errSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="sap">
      <h3>{t('prompts.saveAsPrompt')}</h3>
        {error && <p className="error">{error}</p>}

        <label className="field">
          <span>{t('prompts.title')}</span>
          <input
            className="text-input"
            autoFocus
            placeholder={t('prompts.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="sap-row">
          <div className="sap-tags">
            <LabelPicker value={tags} labels={labels} onChange={setTags} onCreate={onCreateLabel} />
          </div>
          <Toggle
            checked={isPublic}
            onChange={setIsPublic}
            label={t('prompts.publicLabel')}
            labelLeft
            title={t('prompts.publicHint')}
          />
        </div>

        <label className="field">
          <span>{t('prompts.prompt')}</span>
          <textarea
            className="text-input sap-body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary btn-inline"
            disabled={busy || !title.trim() || !body.trim()}
            onClick={() => void save()}
          >
            {busy ? t('common.saving') : t('prompts.saveToLibrary')}
          </button>
        </div>
    </Modal>
  );
}
