import { useTranslation } from 'react-i18next';
import { labelColor, type MarketplacePrompt } from '@lyra/shared';
import { initials } from '../lib/format';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';
import { useEscapeKey } from '../lib/useEscapeKey';
import { promptSegments } from '../lib/promptSegments';
import { CheckIcon, ChatsIcon, ConnectionsIcon, CopyIcon, PlusIcon, XIcon } from '../layout/icons';

type AdoptState = 'idle' | 'busy' | 'done';

// Full view of a catalog prompt — a modal with a hero header (category/type +
// title + contributor·source), the variables it fills, the prompt (highlighted +
// copy / open-in-chat), and a sticky Add-to-library footer. CC0, not editable.
export function MarketplaceDetails({
  prompt,
  state,
  locked,
  onAdopt,
  onOpenInChat,
  onViewLibrary,
  onClose,
}: {
  prompt: MarketplacePrompt;
  state: AdoptState;
  locked?: boolean; // unverified email → adopt disabled
  onAdopt: () => void;
  onOpenInChat: () => void;
  onViewLibrary?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const contributor = prompt.contributor?.trim();
  const done = state === 'done';
  const { copied, copy } = useCopyToClipboard();

  useEscapeKey(onClose);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="mkd-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {/* Hero header */}
        <div className="mkd-head">
          <div className="mkd-head-top">
            <div className="mkd-head-main">
              <div className="mkd-badges">
                {prompt.category && (
                  <span className="mkt-cat-pill">
                    <span className="mkt-dot" style={{ background: labelColor(prompt.category, []) }} />
                    {prompt.category}
                  </span>
                )}
                <span className="mkt-type-pill">
                  {prompt.type === 'structured' ? t('marketplace.typeStructured') : t('marketplace.typeText')}
                </span>
              </div>
              <h2 className="mkd-title">{prompt.title}</h2>
            </div>
            <button className="mkd-close" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
              <XIcon />
            </button>
          </div>

          <div className="mkd-meta">
            <span className="mkd-by">
              <span
                className="mkd-by-avatar"
                style={{ background: labelColor(contributor || prompt.source, []), color: 'var(--on-accent)' }}
                aria-hidden
              >
                {initials(contributor || prompt.source)}
              </span>
              <span>{contributor ? t('marketplace.by', { name: contributor }) : t('marketplace.byUnknown')}</span>
            </span>
            <span className="mkd-source">
              <ConnectionsIcon width={13} height={13} />
              {prompt.source}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="mkd-body">
          {prompt.description && <p className="mkd-desc">{prompt.description}</p>}

          {prompt.variables.length > 0 && (
            <div className="mkd-section">
              <div className="mkd-label">{t('marketplace.fillsVariables')}</div>
              <div className="mkd-vars">
                {prompt.variables.map((v) => (
                  <span key={v} className="mkd-var">{`{${v}}`}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mkd-prompt-head">
            <span className="mkd-label">{t('common.prompt')}</span>
            <div className="mkd-prompt-actions">
              <button type="button" className="mkd-btn" onClick={() => copy(prompt.content)}>
                {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
                {copied ? t('marketplace.copied') : t('marketplace.copy')}
              </button>
              <button type="button" className="mkd-btn" onClick={onOpenInChat}>
                <ChatsIcon width={14} height={14} />
                {t('marketplace.openInChat')}
              </button>
            </div>
          </div>
          <div className="mkd-code">{promptSegments(prompt.content)}</div>
        </div>

        {/* Sticky footer CTA */}
        <div className="mkd-foot">
          {done ? (
            <button type="button" className="mkd-added" onClick={onViewLibrary}>
              <CheckIcon width={16} height={16} />
              {t('marketplace.addedView')}
            </button>
          ) : (
            <button
              type="button"
              className="mkd-add"
              onClick={onAdopt}
              disabled={state === 'busy' || !!locked}
              title={locked ? t('marketplace.confirmEmailToAdd') : undefined}
            >
              <PlusIcon width={16} height={16} />
              {locked ? t('marketplace.confirmEmailToAdd') : state === 'busy' ? t('marketplace.adding') : t('marketplace.add')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
