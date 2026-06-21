import { useEffect } from 'react';

// While mounted, mirror the visual viewport (the area NOT covered by the on-
// screen keyboard) into CSS vars `--vvh` (height) and `--vvt` (offset top) on
// the root. A keyboard-aware modal can then size/position to the visible area
// instead of the full layout viewport — so iOS doesn't scroll the fixed overlay
// up (which otherwise pushes the header off and "loses height"). No-ops where
// the API is unavailable (the CSS falls back to dvh).
export function useViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--vvt');
    };
  }, []);
}
