import { Toggle } from '@lyra/web';

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle checked={false} label="Auto-save" />
      <Toggle checked={true} label="Auto-save" />
      <Toggle checked={true} label="Locked" disabled />
    </div>
  );
}
