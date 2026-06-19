import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { labelColor, type MarketplacePrompt } from '@lyra/shared';
import { PromptCodeBlock } from './PromptCodeBlock';
import { PlusIcon, XIcon } from '../layout/icons';

type AdoptState = 'idle' | 'busy' | 'done';

// Full view of a catalog prompt (opened by the eye icon / title on a marketplace
// card), laid out like prompts.chat's detail: title · author meta · colored tags ·
// the prompt in a code-block (copy + open-in-chat) · adopt. CC0, so not editable.
export function MarketplaceDetails({
  prompt,
  state,
  onAdopt,
  onOpenInChat,
  onClose,
}: {
  prompt: MarketplacePrompt;
  state: AdoptState;
  onAdopt: () => void;
  onOpenInChat: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const contributor = prompt.contributor?.trim();
  const done = state === 'done';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div
        className="dialog prompt-details mkt-details"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pd-head">
          <h3>{prompt.title}</h3>
          <button className="pd-close" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <XIcon />
          </button>
        </div>

        <div className="pd-meta">
          <span>{contributor ? t('marketplace.by', { name: contributor }) : t('marketplace.byUnknown')}</span>
          <span className="pd-dot">·</span>
          <span>{t('marketplace.openSource', { source: prompt.source })}</span>
          {prompt.category && <span className="badge mkt-cat">{prompt.category}</span>}
          <span className="badge mkt-type">
            {prompt.type === 'structured' ? t('marketplace.typeStructured') : t('marketplace.typeText')}
          </span>
        </div>

        {prompt.description && <p className="mkt-details-desc">{prompt.description}</p>}

        {prompt.tags.length > 0 && (
          <div className="mkt-details-tags">
            {prompt.tags.map((tag) => {
              const c = labelColor(tag, []);
              return (
                <span
                  key={tag}
                  className="mkt-tag"
                  style={{ background: `${c}1f`, borderColor: `${c}3a` }}
                >
                  <span className="mkt-tag-dot" style={{ background: c }} />
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {prompt.variables.length > 0 && (
          <div className="pd-tags">
            {prompt.variables.map((v) => (
              <span key={v} className="tag-chip ro mkt-var">{`{${v}}`}</span>
            ))}
          </div>
        )}

        <PromptCodeBlock
          content={prompt.content}
          label={t('common.prompt')}
          onRun={onOpenInChat}
          runLabel={t('marketplace.openInChat')}
        />

        <div className="mkt-details-foot">
          {done ? (
            <span className="mkt-added">{t('marketplace.added')}</span>
          ) : (
            <button type="button" className="btn-primary mkt-details-add" onClick={onAdopt} disabled={state === 'busy'}>
              <PlusIcon width={15} height={15} />
              {state === 'busy' ? t('marketplace.adding') : t('marketplace.add')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
