import { useEffect } from 'react';

/**
 * Locks `<body>` scroll while mounted so the page behind a modal/overlay can't
 * scroll. Restores the previous overflow on unmount (nested modals unwind in LIFO
 * order, so each restores the one beneath it). Compensates for the vanished
 * scrollbar width to avoid a horizontal layout jump on desktop.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [active]);
}
