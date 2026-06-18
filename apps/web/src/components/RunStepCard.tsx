import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  STEP_DEFS,
  STEP_PROVIDERS,
  StepMode,
  StepStatus,
  tagColor,
  unknownStepRefs,
  type Asset,
  type PromptVar,
  type Step,
} from '@lyra/shared';
import { StepResultModal, type StepHistoryEntry } from './StepResultModal';

export const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  skipped: 'Skipped',
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
  // The run this step belongs to — needed by the result modal for downloads.
  runId: string;
  // Composer affordance: variables this step can reference, and every step name
  // in the run (to flag dangling {step:X} references). Optional — when omitted,
  // the card renders exactly as before.
  vars?: PromptVar[];
  stepNames?: string[];
  // Media this step produced (image/video). Rendered as a thumbnail strip.
  assets?: Asset[];
  // Prior runs of the same pipeline for this step (per-run result history).
  history?: StepHistoryEntry[];
}

export function RunStepCard(props: RunStepCardProps) {
  const { step, input, inputLabel, locked, isCurrent, busy, onRun, onApprove, runId, vars, stepNames, assets, history } =
    props;
  const isGate = step.mode === StepMode.Gate;
  const provider = providerOf(step);
  const [showResult, setShowResult] = useState(false);
  // "View result" is a first-class action (decoupled from the prompt): available
  // whenever this step has produced something, or has prior runs to look back on.
  const hasResult =
    !!step.result || !!step.error || (assets?.length ?? 0) > 0 || (history?.length ?? 0) > 0;

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
        {/* inline actions — visible even when collapsed. "View result" is a
            first-class action, independent of the prompt-editing expand. */}
        {(!locked && (step.status === StepStatus.Waiting || runnable)) || hasResult ? (
          <div className="rn-action">
            {!locked && step.status === StepStatus.Waiting && (
              <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={onApprove}>
                Approve
              </button>
            )}
            {!locked && runnable && (
              <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={onRun}>
                Run
              </button>
            )}
            {hasResult && (
              <button
                type="button"
                className="btn-ghost rn-view"
                style={{ width: 'auto', marginTop: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResult(true);
                }}
              >
                View result
              </button>
            )}
          </div>
        ) : null}
      </div>

      {assets && assets.length > 0 && (
        <div className="rn-assets" aria-label={`${assets.length} generated asset${assets.length === 1 ? '' : 's'}`}>
          {assets.map((a) =>
            a.type === 'image' ? (
              <a key={a.id} className="rn-asset" href={a.url} target="_blank" rel="noreferrer" title="Open full size">
                <img src={a.thumbUrl || a.url} alt="" loading="lazy" />
              </a>
            ) : (
              <a key={a.id} className={`rn-asset rn-asset-${a.type}`} href={a.url} target="_blank" rel="noreferrer" title={`Open ${a.type}`}>
                <span className="rn-asset-glyph" aria-hidden>{a.type === 'video' ? '▶' : '♪'}</span>
              </a>
            ),
          )}
        </div>
      )}

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
        </div>
      )}
      {showResult && (
        <StepResultModal
          runId={runId}
          step={step}
          assets={assets ?? []}
          history={history}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  );
}
