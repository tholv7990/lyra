import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketplacePrompt } from '@lyra/shared';
import { Markdown } from './Markdown';
import { ChatsIcon, CheckIcon, CopyIcon, PlusIcon, XIcon } from '../layout/icons';

type AdoptState = 'idle' | 'busy' | 'done';

// Read-only full view of a catalog prompt (opened by the eye icon / title on a
// marketplace card). Reuses the shared .dialog / .pd-* modal shell from
// PromptDetails — a catalog item is CC0 and not editable, so the actions are
// copy / open-in-chat / adopt.
export function MarketplaceDetails({
  prompt,
  state,
  copied,
  onAdopt,
  onCopy,
  onOpenInChat,
  onClose,
}: {
  prompt: MarketplacePrompt;
  state: AdoptState;
  copied: boolean;
  onAdopt: () => void;
  onCopy: () => void;
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
          {prompt.forDevs && <span className="badge mkt-dev">{t('marketplace.devBadge')}</span>}
          <span className="badge mkt-type">
            {prompt.type === 'structured' ? t('marketplace.typeStructured') : t('marketplace.typeText')}
          </span>
        </div>

        {prompt.variables.length > 0 && (
          <div className="pd-tags">
            {prompt.variables.map((v) => (
              <span key={v} className="tag-chip ro mkt-var">{`{${v}}`}</span>
            ))}
          </div>
        )}

        <div className="pd-body">
          <Markdown>{prompt.content}</Markdown>
        </div>

        <div className="mkt-details-foot">
          <div className="mkt-details-left">
            <button type="button" className="btn-ghost mkt-details-act" onClick={onCopy}>
              {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
              {copied ? t('marketplace.copied') : t('marketplace.copy')}
            </button>
            <button type="button" className="btn-ghost mkt-details-act" onClick={onOpenInChat}>
              <ChatsIcon width={15} height={15} />
              {t('marketplace.openInChat')}
            </button>
          </div>
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
