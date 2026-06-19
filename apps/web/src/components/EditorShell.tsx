import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface EditorShellProps {
  /** Header title — usually a borderless `<input className="eshell-name">` or an
   *  `<h2 className="eshell-name">`. Rendered as a flex:1 child of the header. */
  title: ReactNode;
  /** Back/cancel — renders a ‹ button on mobile (the app top bar, and its
   *  breadcrumb back, is hidden there for the full-screen editor). */
  onBack?: () => void;
  /** Right-side header actions (e.g. ✕/✓ icon buttons, a Save button). */
  actions?: ReactNode;
  /** Wider desktop column for builders/workbenches (default is form-width). */
  wide?: boolean;
  /** Scrollable body. */
  children: ReactNode;
}

// The prompt-page layout, generalized: a flat full-height surface with its own
// header (back · title · actions) and a scrolling body. On mobile it hides the
// app top bar and fills the viewport (Claude-app style); on desktop it's a flat,
// fixed-height column. Used by the editor/detail pages so they all match the
// prompt editor + Try chat.
export function EditorShell({ title, onBack, actions, wide, children }: EditorShellProps) {
  const { t } = useTranslation();
  return (
    <div className={`eshell${wide ? ' wide' : ''}`}>
      <div className="eshell-head">
        {onBack && (
          <button type="button" className="eshell-back" onClick={onBack} aria-label={t('common.back')}>
            ‹
          </button>
        )}
        {title}
        {actions && <div className="eshell-actions">{actions}</div>}
      </div>
      <div className="eshell-body">{children}</div>
    </div>
  );
}
