import { type RefObject, useEffect, useRef } from 'react';

/**
 * Calls `onClose` on a mousedown outside `ref`, while `open` is true. Replaces
 * the identical effect copy-pasted across every menu/popover. The latest
 * `onClose` is held in a ref so passing an inline closure doesn't re-subscribe
 * the listener on every render (effect re-runs only when `open` changes).
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, ref]);
}
