// Linear-style switch: a pill track + sliding knob. Token-only; the native
// checkbox (role=switch) drives state/focus/keyboard.
export function Toggle({
  checked,
  onChange,
  label,
  labelLeft,
  title,
  disabled,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  /** Render the label before the switch (default: after). */
  labelLeft?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  const text = label ? <span className="tgl-label">{label}</span> : null;
  return (
    <label className="tgl" title={title}>
      {labelLeft && text}
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
      {!labelLeft && text}
    </label>
  );
}
