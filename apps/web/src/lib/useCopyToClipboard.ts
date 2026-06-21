import { useRef, useState } from 'react';

/**
 * Copy text to the clipboard and flash a transient `copied` flag for `duration`
 * ms. Replaces the `setCopied(true)` + `setTimeout(() => setCopied(false), …)`
 * block that was copy-pasted across every copy button — with drifted timeouts
 * (1400/1500/1600ms) and one (Members invite link) that never reset. Re-copying
 * restarts the timer; clipboard failures (blocked/unavailable) are swallowed.
 */
export function useCopyToClipboard(duration = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function copy(text: string) {
    void navigator.clipboard?.writeText(text)?.catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), duration);
  }

  return { copied, copy };
}
