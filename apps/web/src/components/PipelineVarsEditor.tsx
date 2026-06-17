import type { PipelineVariable } from '@lyra/shared';

// Define a pipeline's custom variables (key / label / default). Each is
// referenced in step prompts as {key}; its value is entered when a run starts.
export function PipelineVarsEditor({
  variables,
  disabled,
  onChange,
}: {
  variables: PipelineVariable[];
  disabled?: boolean;
  onChange: (v: PipelineVariable[]) => void;
}) {
  const update = (i: number, patch: Partial<PipelineVariable>) =>
    onChange(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const remove = (i: number) => onChange(variables.filter((_, idx) => idx !== i));
  const add = () => onChange([...variables, { key: '', label: '', default: '' }]);

  // No variables yet → collapse to a single compact control (saves vertical space).
  if (variables.length === 0) {
    if (disabled) return null;
    return (
      <button
        className="btn-ghost pvars-add pvars-empty"
        style={{ width: 'auto', marginTop: 0 }}
        onClick={add}
        title="Define a {key} variable, entered when a run starts"
      >
        + Add variable
      </button>
    );
  }

  return (
    <div className="pvars">
      <div className="pvars-head">
        <span className="pvars-title">Variables</span>
        <span className="muted" style={{ fontSize: 12 }}>
          Use in step prompts as <code>{'{key}'}</code> · values entered at run start
        </span>
      </div>
      {variables.map((v, i) => (
        <div key={i} className="pvars-row">
          <input
            className="text-input"
            placeholder="key"
            value={v.key}
            disabled={disabled}
            onChange={(e) => update(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
          />
          <input
            className="text-input"
            placeholder="label (optional)"
            value={v.label ?? ''}
            disabled={disabled}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            className="text-input"
            placeholder="default (optional)"
            value={v.default ?? ''}
            disabled={disabled}
            onChange={(e) => update(i, { default: e.target.value })}
          />
          {!disabled && (
            <button className="icon-mini danger" title="Remove variable" onClick={() => remove(i)}>
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button className="btn-ghost pvars-add" style={{ width: 'auto', marginTop: 0 }} onClick={add}>
          + Add variable
        </button>
      )}
    </div>
  );
}
