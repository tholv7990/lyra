import { useState } from 'react';
import type { PipelineVariable } from '@lyra/shared';

// Collect values for a pipeline's custom variables at run start, prefilled from
// each variable's default. Returns the entered values to the caller, which sends
// them with the run-create request.
export function RunVariablesModal({
  title,
  variables,
  prefill,
  busy,
  onCancel,
  onRun,
}: {
  title: string;
  variables: PipelineVariable[];
  // Values to seed fields with (e.g. the project's variables) — used when a key
  // matches; falls back to the pipeline variable's own default.
  prefill?: Record<string, string>;
  busy?: boolean;
  onCancel: () => void;
  onRun: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      variables.map((v) => [v.key, prefill?.[v.key] ?? v.default ?? '']),
    ),
  );
  return (
    <div className="drawer-scrim" onClick={onCancel}>
      <div className="drawer runvars" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Fill the variables this pipeline uses — they resolve into every step prompt.
        </p>
        <div className="runvars-fields">
          {variables.map((v) => (
            <label key={v.key} className="runvars-field">
              <span className="runvars-flabel">
                {v.label?.trim() || v.key} <code>{`{${v.key}}`}</code>
              </span>
              <input
                className="text-input"
                value={values[v.key] ?? ''}
                placeholder={v.default ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [v.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="runvars-actions">
          <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={busy}
            onClick={() => onRun(values)}
          >
            {busy ? 'Starting…' : 'Run ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}
