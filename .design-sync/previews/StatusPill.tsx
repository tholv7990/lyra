import { StatusPill } from '@lyra/web';

export function Statuses() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <StatusPill status="draft" />
      <StatusPill status="public" />
    </div>
  );
}
