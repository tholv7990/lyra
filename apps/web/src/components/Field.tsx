import type { ReactNode } from 'react';

// The Linear/Plane form-field anatomy: label (+ optional required mark) · control
// · hint or error. Wraps the existing `.field`/`.text-input` patterns so every
// editor gets consistent labelling, help text, and an error state. The control
// is `children` — pass an <input className="text-input">, a MenuPicker, etc.
export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  /** When set, the field renders its danger state and shows this instead of the hint. */
  error?: ReactNode;
  /** Associates the label with a control rendered outside this wrapper (rare). */
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field${error ? ' field-invalid' : ''}`} htmlFor={htmlFor}>
      {label && (
        <span>
          {label}
          {required && <em className="field-req" aria-hidden="true">*</em>}
        </span>
      )}
      {children}
      {error ? (
        <span className="field-msg err" role="alert">{error}</span>
      ) : hint ? (
        <span className="field-msg">{hint}</span>
      ) : null}
    </label>
  );
}
