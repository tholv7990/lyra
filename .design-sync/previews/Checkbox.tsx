import { Checkbox } from '@lyra/web';

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checkbox checked={false} label="Include drafts" />
      <Checkbox checked={true} label="Include drafts" />
      <Checkbox checked={true} label="Locked" disabled />
    </div>
  );
}
