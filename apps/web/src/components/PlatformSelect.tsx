import { useRef, useState } from 'react';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useEscapeKey } from '../lib/useEscapeKey';
import { PLATFORMS, platformColor, platformGlyph, platformLabel } from '../lib/platform';

// Nice icon+name dropdown for picking a social platform (TikTok / YouTube /
// Instagram / Facebook / X). Mirrors TypeSelect's trigger+menu pattern (outside-
// click + Escape to close), with each option shown as a brand-coloured icon chip +
// its display name. The selected platform's chip + name fill the trigger.
export function PlatformSelect({
  value,
  onChange,
  platforms = PLATFORMS,
  labelledBy,
}: {
  value: string;
  onChange: (platform: string) => void;
  platforms?: readonly string[];
  labelledBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));
  useEscapeKey(() => setOpen(false), open);

  return (
    <div className="plat-select" ref={ref}>
      <button
        type="button"
        className={`plat-select-btn ${open ? 'active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        onClick={() => setOpen((s) => !s)}
      >
        <span className="plat-ico" style={{ background: platformColor(value) }} aria-hidden>{platformGlyph(value)}</span>
        <span className="plat-select-value">{platformLabel(value)}</span>
        <span className="plat-select-chevron" aria-hidden />
      </button>
      {open && (
        <div className="lin-menu plat-select-menu" role="listbox" aria-labelledby={labelledBy}>
          {platforms.map((p) => {
            const selected = value === p;
            return (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={selected}
                className="lin-menu-item plat-select-opt"
                onClick={() => { onChange(p); setOpen(false); }}
              >
                <span className="plat-ico" style={{ background: platformColor(p) }} aria-hidden>{platformGlyph(p)}</span>
                {platformLabel(p)}
                {selected && <span className="lin-menu-check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
