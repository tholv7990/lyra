// Linear-style switch: a pill track + sliding knob. Token-only; the native
// checkbox (role=switch) drives state/focus/keyboard.
export function Toggle({
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
    <label className="tgl">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="tgl-track" aria-hidden="true">
        <span className="tgl-knob" />
      </span>
      {label && <span className="tgl-label">{label}</span>}
    </label>
  );
}
