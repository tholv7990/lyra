import { CheckIcon } from '../layout/icons';

// Linear-style checkbox: a small rounded box that fills with the accent + a check
// when on. Token-only; the native input drives state/focus/keyboard.
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="cbx">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="cbx-box" aria-hidden="true">
        <CheckIcon />
      </span>
      {label && <span className="cbx-label">{label}</span>}
    </label>
  );
}
