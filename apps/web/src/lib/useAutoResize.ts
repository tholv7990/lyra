import { useEffect, type RefObject } from 'react';

// Auto-grow a textarea: collapse to a single line, then expand to fit its
// content up to maxHeight (after which it scrolls). Re-runs whenever `value`
// changes, so the composer starts at one line and grows to two+ as you type.
export function useAutoResize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight = 200,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [ref, value, maxHeight]);
}
