import { useEffect } from 'react';

/**
 * While `active`, mirrors the visual viewport's height + top offset onto CSS vars
 * (`--vv-height`, `--vv-top`) on the root element. A full-screen modal can then size
 * itself to the area NOT covered by the on-screen keyboard — iOS doesn't shrink
 * `100dvh` when the keyboard opens, which otherwise pushes the modal's header
 * off-screen. No-op where `visualViewport` is unavailable.
 */
export function useViewportFit(active = true) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--vv-height', `${vv.height}px`);
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--vv-height');
      root.style.removeProperty('--vv-top');
    };
  }, [active]);
}
