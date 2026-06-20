export type ToastKind = 'info' | 'success' | 'error';

// A single toast surface (status/feedback). A real toast system would portal a
// stack of these; this is the visual primitive.
export function Toast({
  message,
  kind = 'info',
  onClose,
}: {
  message: string;
  kind?: ToastKind;
  onClose?: () => void;
}) {
  return (
    <div className={`toast toast-${kind}`} role="status">
      <span className="toast-dot" aria-hidden="true" />
      <span className="toast-msg">{message}</span>
      {onClose && (
        <button type="button" className="toast-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      )}
    </div>
  );
}
