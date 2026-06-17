import { useEffect, useState } from 'react';

// True below the app's mobile breakpoint (820px) — where the app top bar (and its
// breadcrumb) is hidden, so full-screen editor pages must render their own title.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return isMobile;
}
