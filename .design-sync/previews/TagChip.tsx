import { TagChip } from '@lyra/web';

export function Tags() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <TagChip label="ecom" />
      <TagChip label="paid-social" />
      <TagChip label="brand" />
      <TagChip label="winner" />
    </div>
  );
}
