import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PromptType } from '@lyra/shared';
import { useOutsideClick } from '../lib/useOutsideClick';
import { TYPE_COLOR, TYPE_ICON } from '../lib/promptType';

// Compact icon+text dropdown for the prompt output type. Reuses the app's
// `.lin-filter` / `.lin-menu` popover pattern (trigger button + absolutely
// positioned menu, outside-click + Escape to close, keyboard select) — the same
// pattern the Prompts filter popover uses — restyled with the per-type colored
// glyphs from `TYPE_COLOR`/`TYPE_ICON`. The trigger shows the selected type's
// colored icon + label + a chevron; the menu lists the four types, the current
// one checked.
export function TypeSelect({
  value,
  onChange,
  labelledBy,
}: {
  value: PromptType;
  onChange: (type: PromptType) => void;
  // id of the visible field label, so the trigger is named for screen readers.
  labelledBy?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape, mirroring the Prompts filter popover.
  useOutsideClick(ref, open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const SelectedIcon = TYPE_ICON[value];

  return (
    <div className="type-select" ref={ref}>
      <button
        type="button"
        className={`type-select-btn ${open ? 'active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        onClick={() => setOpen((s) => !s)}
      >
        <SelectedIcon
          className="type-select-icon"
          width={15}
          height={15}
          style={{ color: TYPE_COLOR[value] }}
          aria-hidden="true"
        />
        <span className="type-select-value">{t(`prompts.type.${value}`)}</span>
        <span className="type-select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="lin-menu type-select-menu" role="listbox" aria-labelledby={labelledBy}>
          {Object.values(PromptType).map((ty) => {
            const TypeIcon = TYPE_ICON[ty];
            const selected = value === ty;
            return (
              <button
                key={ty}
                type="button"
                role="option"
                aria-selected={selected}
                className="lin-menu-item"
                onClick={() => {
                  onChange(ty);
                  setOpen(false);
                }}
              >
                <TypeIcon
                  width={15}
                  height={15}
                  style={{ color: TYPE_COLOR[ty] }}
                  aria-hidden="true"
                />
                {t(`prompts.type.${ty}`)}
                {selected && <span className="lin-menu-check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
