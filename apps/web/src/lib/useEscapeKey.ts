import { useEffect, useRef } from 'react';

/**
 * Calls `onEscape` when the Escape key is pressed, while `enabled` (default
 * true). Replaces the keydown listener copy-pasted across every modal and
 * dropdown. The latest `onEscape` is held in a ref so an inline closure doesn't
 * re-subscribe the listener on every render. Pair with `useOutsideClick` for
 * popovers; for modals that only mount while open, leave `enabled` at its
 * default.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
