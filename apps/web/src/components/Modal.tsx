import { type ReactNode } from 'react';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useScrollLock } from '../lib/useScrollLock';

/**
 * Centered modal shell: the `dialog-scrim` backdrop (click to close) + the
 * `dialog` box (role/aria-modal, stops click-through) + Escape-to-close.
 * Unifies the eight `.dialog-scrim`/`.dialog` modals — each passes its own
 * `className` extension (e.g. `sap`, `srm`, `bwa bwa-chat`) and supplies its own
 * header/close-button/content as children. Standardizes Escape close (three of
 * the modals previously lacked it).
 */
export function Modal({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEscapeKey(onClose);
  useScrollLock();
  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div
        className={className ? `dialog ${className}` : 'dialog'}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
