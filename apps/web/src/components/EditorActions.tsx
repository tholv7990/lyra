import { CheckIcon, XIcon } from '../layout/icons';

// The shared confirm/cancel action pair: ✓ green (confirm) · ✕ red (cancel).
// Used by the add-step drawer and the create/edit-pipeline header — same
// component, different settings. Renders as a fragment so the caller's flex
// container (eshell-actions / addstep-actions) controls spacing.
export function EditorActions({
  onConfirm,
  onCancel,
  confirmDisabled,
  confirmTitle = 'Confirm',
  cancelTitle = 'Cancel',
}: {
  onConfirm?: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  confirmTitle?: string;
  cancelTitle?: string;
}) {
  return (
    <>
      <button
        type="button"
        className="icon-btn-success"
        title={confirmTitle}
        aria-label={confirmTitle}
        disabled={confirmDisabled}
        onClick={onConfirm}
      >
        <CheckIcon width={16} height={16} />
      </button>
      <button
        type="button"
        className="icon-btn-danger"
        title={cancelTitle}
        aria-label={cancelTitle}
        onClick={onCancel}
      >
        <XIcon />
      </button>
    </>
  );
}
