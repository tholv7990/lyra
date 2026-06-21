import { labelColor } from '@lyra/shared';

/**
 * Read-only tag chip: a deterministic coloured dot + the label. Unifies the
 * display chip that existed as both `mkt-chip`+`mkt-dot` and `tag-chip`+`tdot`.
 * (The editable chips — LabelPicker / TagInput, which carry a remove button —
 * keep their own markup.)
 */
export function TagChip({
  label,
  labels = [],
}: {
  label: string;
  labels?: Parameters<typeof labelColor>[1];
}) {
  return (
    <span className="tag-chip">
      <span className="tdot" style={{ background: labelColor(label, labels) }} />
      {label}
    </span>
  );
}
