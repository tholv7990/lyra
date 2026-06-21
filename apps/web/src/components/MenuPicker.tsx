import { useRef, useState, type ReactNode } from 'react';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useEscapeKey } from '../lib/useEscapeKey';

export interface MenuPickerOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

// The shared single-select control: an icon+label trigger that opens a menu of
// options (icon + label rows). Status, priority, and any "pick one" field use
// this — replaces the per-field copies of the same trigger→menu shape.
export function MenuPicker<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: T;
  options: MenuPickerOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));
  useEscapeKey(() => setOpen(false), open);
  const current = options.find((o) => o.value === value);

  return (
    <div className="menupick-wrap" ref={ref}>
      <button
        type="button"
        className="menupick-btn"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.icon}
        {current?.label ?? value}
      </button>
      {open && (
        <div className="lin-menu menupick-menu" role="menu">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className="lin-menu-item"
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
