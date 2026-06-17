import { useState } from 'react';
import type { PipelineVariable } from '@lyra/shared';

// One item per non-empty line.
function splitItems(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Collect values for a pipeline's custom variables AND any fan-out collections at
// run start. Variables prefill from each variable's default (or a matching project
// variable); collections are entered one item per line. Returns both to the caller,
// which sends them with the run-create request.
export function RunVariablesModal({
  title,
  variables,
  collections = [],
  prefill,
  busy,
  onCancel,
  onRun,
}: {
  title: string;
  variables: PipelineVariable[];
  // Names of fan-out collections this pipeline maps over (one input box each).
  collections?: string[];
  // Values to seed variable fields with (e.g. the project's variables) — used when
  // a key matches; falls back to the pipeline variable's own default.
  prefill?: Record<string, string>;
  busy?: boolean;
  onCancel: () => void;
  onRun: (values: Record<string, string>, collections: Record<string, string[]>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v.key, prefill?.[v.key] ?? v.default ?? ''])),
  );
  const [lists, setLists] = useState<Record<string, string>>(() =>
    Object.fromEntries(collections.map((c) => [c, ''])),
  );
  const submit = () =>
    onRun(
      values,
      Object.fromEntries(collections.map((c) => [c, splitItems(lists[c] ?? '')])),
    );
  return (
    <div className="drawer-scrim" onClick={onCancel}>
      <div className="drawer runvars" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {collections.length > 0
            ? 'Fill the variables and the items each fan-out step maps over.'
            : 'Fill the variables this pipeline uses — they resolve into every step prompt.'}
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
          {collections.map((c) => (
            <label key={c} className="runvars-field">
              <span className="runvars-flabel">
                Fan-out items <code>{`${c}`}</code>
                <span className="muted" style={{ fontWeight: 400 }}>· one per line</span>
              </span>
              <textarea
                className="text-input"
                rows={4}
                value={lists[c] ?? ''}
                placeholder={'item one\nitem two\nitem three'}
                onChange={(e) => setLists((s) => ({ ...s, [c]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="runvars-actions">
          <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={submit}>
            {busy ? 'Starting…' : 'Run ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}
