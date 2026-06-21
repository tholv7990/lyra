import { useState } from 'react';
import { FingerprintIcon } from '../layout/icons';

// The GoLogin connection mark. Renders the official logo from /gologin.svg when the
// asset is present; until then (or if it fails to load) it falls back to a neutral
// fingerprint glyph. To use the real logo, drop the file at apps/web/public/gologin.svg
// (a transparent SVG/PNG) — no code change needed.
export function GologinMark({ size = 11 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <FingerprintIcon width={size} height={size} />;
  return (
    <img
      src="/gologin.svg"
      width={size}
      height={size}
      alt=""
      className="gologin-mark"
      onError={() => setFailed(true)}
    />
  );
}
