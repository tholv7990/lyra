import { ConfirmDialog } from '@lyra/web';

export function Default() {
  return (
    <ConfirmDialog
      open
      danger
      title="Delete pipeline?"
      message={'“Find winning products” will be removed from the library. Runs already created from it are kept. This cannot be undone.'}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  );
}
