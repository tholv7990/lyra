import { Modal } from '@lyra/web';

export function Default() {
  return (
    <Modal onClose={() => {}}>
      <h3>Rename pipeline</h3>
      <p>Give this pipeline a clear, descriptive name.</p>
      <input className="text-input" defaultValue="Find winning products" />
      <div className="dialog-actions" style={{ marginTop: 16 }}>
        <button className="btn-ghost">Cancel</button>
        <button className="btn-primary btn-inline">Save</button>
      </div>
    </Modal>
  );
}
