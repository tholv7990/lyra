import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppNav } from '../layout/breadcrumb';
import { XIcon } from '../layout/icons';

interface EditorShellProps {
  /** Header title — usually a borderless `<input className="eshell-name">` or an
   *  `<h2 className="eshell-name">`. Rendered as a flex:1 child of the header. */
  title: ReactNode;
  /** Module breadcrumb shown before the title (e.g. { label: 'Prompts', to:
   *  '/prompts' }). Mobile-only — on desktop the app top bar already shows the
   *  breadcrumb, so it's hidden here to avoid duplication. */
  crumb?: { label: string; to: string };
  /** Close (✕) — the universal dismiss at the far right of the header. Editors
   *  also place a ✓ save in `actions`; view pages get only this ✕. */
  onClose?: () => void;
  /** Page-specific header actions placed before the ✕ (e.g. ✓ save, AI/Test). */
  actions?: ReactNode;
  /** Wider desktop column for builders/workbenches (default is form-width). */
  wide?: boolean;
  /** Scrollable body. */
  children: ReactNode;
}

// The prompt-page layout, generalized: a flat full-height surface with one
// floating-bar header — logo (opens nav) · module/title · actions · ✕ — and a
// scrolling body. Mirrors the Chats header so every create/edit/view page shares
// one nav style. On mobile it hides the app top bar and fills the viewport
// (Claude-app style); on desktop it's a flat fixed-height column where the
// breadcrumb lives in the top bar, so the logo + crumb here are mobile-only.
export function EditorShell({ title, crumb, onClose, actions, wide, children }: EditorShellProps) {
  const { t } = useTranslation();
  const openNav = useAppNav();
  return (
    <div className={`eshell${wide ? ' wide' : ''}`}>
      <div className="eshell-head">
        <button
          type="button"
          className="eshell-logo"
          onClick={openNav}
          aria-label={t('common.openMenu')}
          title={t('common.menu')}
        >
          <img src="/lyra-mark-squircle.svg" alt="Lyra" width={24} height={24} />
        </button>
        <div className="eshell-headinfo">
          {crumb && (
            <>
              <Link to={crumb.to} className="eshell-crumb">{crumb.label}</Link>
              <span className="eshell-crumb-sep">/</span>
            </>
          )}
          {title}
        </div>
        {(actions || onClose) && (
          <div className="eshell-actions">
            {actions}
            {onClose && (
              <button
                type="button"
                className="cicon eshell-close"
                onClick={onClose}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <XIcon />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="eshell-body">{children}</div>
    </div>
  );
}
