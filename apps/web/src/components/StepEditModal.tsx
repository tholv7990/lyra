import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODEL_CATALOG, type PromptMedia, type Provider } from '@lyra/shared';
import { api } from '../lib/api';
import { Composer } from './Composer';
import { Modal } from './Modal';

export interface StepEditModalProps {
  wsId: string;
  stepIndex: number;
  prompt: string;
  media: PromptMedia[];
  provider: Provider;
  model: string;
  onClose: () => void;
  onSavePrompt: (i: number, prompt: string) => Promise<unknown>;
  onSaveModel: (i: number, provider: Provider, model: string) => Promise<unknown>;
  onSaveMedia: (i: number, media: PromptMedia[]) => Promise<unknown>;
  onSaveToPipeline?: (i: number) => Promise<unknown>;
  onRerun?: (i: number) => void;
  canPromote?: boolean;
}

export function StepEditModal({
  wsId,
  stepIndex,
  prompt,
  media,
  provider,
  model,
  onClose,
  onSavePrompt,
  onSaveModel,
  onSaveMedia,
  onSaveToPipeline,
  onRerun,
  canPromote,
}: StepEditModalProps) {
  const { t } = useTranslation();

  const [draftPrompt, setDraftPrompt] = useState(prompt);
  const [draftMedia, setDraftMedia] = useState<PromptMedia[]>(media);
  const [draftProvider, setDraftProvider] = useState<Provider>(provider);
  const [draftModel, setDraftModel] = useState(model);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files) return;
    setUploading((n) => n + files.length);
    const results: PromptMedia[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const uploaded = await api<PromptMedia>(`/workspaces/${wsId}/files`, {
          method: 'POST',
          body: fd,
        });
        results.push(uploaded);
      } catch {
        // silently skip failed uploads
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (results.length > 0) {
      setDraftMedia((prev) => [...prev, ...results]);
    }
  }

  function removeMedia(index: number) {
    setDraftMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function handleModelChange(p: Provider, m: string) {
    setDraftProvider(p);
    setDraftModel(m);
  }

  async function persistChanges() {
    const saves: Promise<unknown>[] = [];
    if (draftPrompt !== prompt) saves.push(onSavePrompt(stepIndex, draftPrompt));
    if (draftProvider !== provider || draftModel !== model)
      saves.push(onSaveModel(stepIndex, draftProvider, draftModel));
    if (JSON.stringify(draftMedia) !== JSON.stringify(media))
      saves.push(onSaveMedia(stepIndex, draftMedia));
    await Promise.all(saves);
  }

  async function handleSaveRerun() {
    setBusy(true);
    setError(null);
    try {
      await persistChanges();
      onRerun?.(stepIndex);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('run.savePrompt'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveToPipeline() {
    setBusy(true);
    setError(null);
    try {
      await persistChanges();
      await onSaveToPipeline?.(stepIndex);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('run.saveToPipeline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="sem">
      <div className="sem-header">
        <h3 className="sem-title">{t('run.editStep')}</h3>
        <button type="button" className="icon-btn sem-close" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="sem-body">
        <Composer
          hideSend
          value={draftPrompt}
          onChange={setDraftPrompt}
          media={draftMedia}
          onFiles={uploadFiles}
          onRemoveMedia={removeMedia}
          uploading={uploading}
          catalog={MODEL_CATALOG}
          provider={draftProvider}
          model={draftModel}
          onModelChange={handleModelChange}
          placeholder={t('run.testPromptPlaceholder')}
        />
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
        {canPromote && onSaveToPipeline && (
          <button
            type="button"
            className="btn-ghost btn-inline"
            disabled={busy}
            onClick={() => void handleSaveToPipeline()}
          >
            {t('run.saveToPipeline')}
          </button>
        )}
        <button
          type="button"
          className="btn-primary btn-inline"
          disabled={busy}
          onClick={() => void handleSaveRerun()}
        >
          {t('run.saveAndRerun')}
        </button>
      </div>
    </Modal>
  );
}
