import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Prompt, PromptMedia, Provider } from '@lyra/shared';
import { api } from '../lib/api';
import type { ModelCatalog } from '../lib/useModels';
import { useViewportFit } from '../lib/useViewportFit';
import { ChatPane } from './ChatPane';
import { Modal } from './Modal';

export interface StepTestModalProps {
  wsId: string;
  title: string;
  promptId?: string;
  initialPrompt: string;
  initialMedia: PromptMedia[];
  provider: Provider;
  model: string;
  catalog: ModelCatalog;
  onClose: () => void;
}

/**
 * "Test this step" — a centered chat modal (the shared `<Modal>` shell, same as the
 * Build-with-AI popup) wrapping the shared `<ChatPane>`, seeded with the step's prompt,
 * provider, and model. Reuses the chat instead of reimplementing it.
 */
export function StepTestModal({
  wsId,
  title,
  promptId,
  initialPrompt,
  initialMedia,
  provider,
  model,
  catalog,
  onClose,
}: StepTestModalProps) {
  const { t } = useTranslation();
  // Keep the full-screen modal within the keyboard-free area on mobile.
  useViewportFit();
  const [seedInput, setSeedInput] = useState(initialPrompt);
  const [seedMedia, setSeedMedia] = useState(initialMedia);

  // The builder usually passes the prompt body; if it didn't (prompt not in the loaded
  // list), resolve it from the id so the composer still opens pre-filled. Best-effort.
  useEffect(() => {
    if (initialPrompt.trim() || !promptId) return;
    let cancelled = false;
    api<Prompt>(`/prompts/${promptId}`)
      .then((p) => {
        if (cancelled) return;
        setSeedInput(p.content);
        if (initialMedia.length === 0) setSeedMedia(p.media ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [promptId, initialPrompt, initialMedia]);

  return (
    <Modal onClose={onClose} className="bwa-chat full-mobile">
      <div className="bwa-head">
        <h3>{t('run.testTitle', { title })}</h3>
        <button type="button" className="srm-x" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>
      </div>

      <ChatPane
        wsId={wsId}
        catalog={catalog}
        initialProvider={provider}
        initialModel={model}
        seedInput={seedInput}
        seedMedia={seedMedia}
        autoFocus
        composerPlaceholder={t('run.testPromptPlaceholder')}
        emptyState={
          <div className="chat-empty">
            <h3>{t('run.testThisNode')}</h3>
            <p>{t('run.testNodeHint')}</p>
          </div>
        }
      />
    </Modal>
  );
}
