import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  STEP_DEFS,
  STEP_PROVIDERS,
  StepMode,
  StepStatus,
  tagColor,
  unknownStepRefs,
  type PromptVar,
  type Step,
} from '@lyra/shared';

export const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  done: 'Done',
  error: 'Error',
};

export function stepTitle(step: Step) {
  return step.name?.trim() || STEP_DEFS[step.index]?.title || `Step ${step.index + 1}`;
}

export function providerOf(step: Step): string {
  return step.provider ?? (step.key ? STEP_PROVIDERS[step.key] : '') ?? '';
}

export interface RunStepCardProps {
  step: Step;
  input: string;
  inputLabel: string;
  locked: boolean;
  isCurrent: boolean;
  busy: boolean;
  onRun: () => void;
  onApprove: () => void;
  onSavePrompt: (prompt: string) => void;
  // Composer affordance: variables this step can reference, and every step name
  // in the run (to flag dangling {step:X} references). Optional — when omitted,
  // the card renders exactly as before.
  vars?: PromptVar[];
  stepNames?: string[];
}

export function RunStepCard(props: RunStepCardProps) {
  const { step, input, inputLabel, locked, isCurrent, busy, onRun, onApprove, vars, stepNames } =
    props;
  const isGate = step.mode === StepMode.Gate;
  const provider = providerOf(step);
  const waitingForResult =
    !step.result &&
    !step.error &&
    (step.status === StepStatus.Queued || step.status === StepStatus.Running);

  // Auto-open the node that needs attention (current / gate / errored).
  const wantsAttention =
    isCurrent || step.status === StepStatus.Waiting || step.status === StepStatus.Error;
  const [expanded, setExpanded] = useState(wantsAttention);
  const [draft, setDraft] = useState(step.prompt);
  useEffect(() => setDraft(step.prompt), [step.prompt]);
  const dirty = draft !== step.prompt;

  const taRef = useRef<HTMLTextAreaElement>(null);
  const dangling = unknownStepRefs(draft, stepNames ?? []);

  // Insert a variable token at the cursor (or append if the textarea isn't focused).
  function insertToken(token: string) {
    const ta = taRef.current;
    if (!ta) {
      setDraft((d) => d + token);
      return;
    }
    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + token + draft.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const runnable = isCurrent && step.status !== StepStatus.Done && step.status !== StepStatus.Waiting;
  const accent = tagColor(step.name || step.promptId || String(step.index));

  return (
    <div
      className={`flow-node run status-${step.status}${isCurrent ? ' current' : ''}${expanded ? ' open' : ''}`}
      style={{ '--accent': accent } as CSSProperties}
    >
      <div className="rn-row">
        <div className="rn-status"><span className={`rn-dot status-${step.status}`} aria-hidden /></div>
        <button type="button" className="flow-node-main" onClick={() => setExpanded((v) => !v)}>
          <div className="flow-node-head">
            <span className="flow-num">{step.index + 1}</span>
            <span className="flow-name">{stepTitle(step)}</span>
            <span className={`mode-tag ${isGate ? 'gate' : 'auto'}`}>{isGate ? 'GATE' : 'AUTO'}</span>
            <span className={`badge status-${step.status}`}>{STATUS_LABEL[step.status] ?? step.status}</span>
          </div>
          <div className="flow-node-sub">{step.model}</div>
        </button>
        {/* primary inline action — visible even when collapsed */}
        {!locked && step.status === StepStatus.Waiting ? (
          <div className="rn-action">
            <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={onApprove}>
              Approve
            </button>
          </div>
        ) : !locked && runnable ? (
          <div className="rn-action">
            <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={onRun}>
              Run
            </button>
          </div>
        ) : null}
      </div>

      {expanded && (
        <div className="rn-body">
          {input.trim() && (
            <div className="rn-input">
              <div className="rn-input-label">{inputLabel}</div>
              <pre className="result-box rn-input-box">{input}</pre>
            </div>
          )}
          {vars && vars.length > 0 && (
            <div className="rn-vars">
              <span className="rn-vars-label">Insert</span>
              {vars.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  className={`var-chip kind-${v.kind}`}
                  title={`Insert ${v.token}`}
                  onClick={() => insertToken(v.token)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            className="text-input prompt-area"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {dangling.length > 0 && (
            <p className="rn-var-warn">
              Unknown step reference{dangling.length > 1 ? 's' : ''}:{' '}
              {dangling.map((n) => `{step:${n}}`).join(', ')} — no matching step.
            </p>
          )}
          <div className="rn-body-actions">
            {dirty && (
              <button className="btn-ghost" disabled={busy} onClick={() => props.onSavePrompt(draft)}>
                Save prompt
              </button>
            )}
            {locked && (
              <span className="muted" style={{ fontSize: 13 }}>
                Locked — set the <strong>{provider}</strong> key in{' '}
                <Link to="/settings" style={{ color: 'var(--primary)' }}>Settings</Link>
              </span>
            )}
          </div>
          {step.error && <p className="step-error">{step.error}</p>}
          {waitingForResult && (
            <div className="result-box rn-result-pin rn-result-waiting">
              <span className="rn-result-spinner" aria-hidden />
              <span>Waiting for result</span>
            </div>
          )}
          {step.result && <pre className="result-box rn-result-pin">{step.result}</pre>}
        </div>
      )}
    </div>
  );
}
