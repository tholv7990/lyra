import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  STEP_DEFS,
  STEP_PROVIDERS,
  StepMode,
  StepStatus,
  tagColor,
  type Run,
  type Step,
} from '@lyra/shared';
import { FlowPagerControls, useFlowPager } from './FlowPager';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  done: 'Done',
  error: 'Error',
};

function stepTitle(step: Step) {
  return step.name?.trim() || STEP_DEFS[step.index]?.title || `Step ${step.index + 1}`;
}

function providerOf(step: Step): string {
  return step.provider ?? (step.key ? STEP_PROVIDERS[step.key] : '') ?? '';
}

interface RunFlowProps {
  run: Run;
  busy: boolean;
  hasKey: (provider: string) => boolean;
  onRunStep: (index: number) => void;
  onApprove: (index: number) => void;
  onSavePrompt: (index: number, prompt: string) => void;
}

// The unified run view (n8n-style): the pipeline rendered as the same vertical
// flow as the builder (Start → nodes → End), lit up with live per-step status.
// Each node shows its status, an inline Run/Approve action, and — when expanded —
// the (editable) prompt and the result/error.
export function RunFlow({ run, busy, hasKey, onRunStep, onApprove, onSavePrompt }: RunFlowProps) {
  const pager = useFlowPager(run.steps.length);
  const { isMobile, setPage } = pager;

  // On mobile, follow the active step as the run progresses.
  useEffect(() => {
    if (isMobile && (run.status === 'running' || run.status === 'awaiting_gate')) {
      setPage(run.currentStep + 1);
    }
  }, [isMobile, run.status, run.currentStep, setPage]);

  const node = (step: Step) => (
    <RunNode
      key={step.index}
      step={step}
      // each node's input = the previous step's output (the {note} seeds step 1)
      input={step.index > 0 ? run.steps[step.index - 1]?.result ?? '' : run.context?.note ?? ''}
      inputLabel={step.index > 0 ? 'Input · from previous step' : 'Input · note'}
      locked={!hasKey(providerOf(step))}
      isCurrent={step.index === run.currentStep && run.status !== 'done'}
      busy={busy}
      onRun={() => onRunStep(step.index)}
      onApprove={() => onApprove(step.index)}
      onSavePrompt={(p) => onSavePrompt(step.index, p)}
    />
  );

  if (isMobile) {
    const { page } = pager;
    const step = page >= 1 && page <= run.steps.length ? run.steps[page - 1] : null;
    return (
      <div className="flow run-flow pager">
        {page === 0 && <div className="flow-cap">● Start</div>}
        {step && node(step)}
        {page === run.steps.length + 1 && <div className="flow-cap end">◉ End</div>}
        <FlowPagerControls pager={pager} stepCount={run.steps.length} />
      </div>
    );
  }

  return (
    <div className="flow run-flow">
      <div className="flow-cap">● Start</div>
      {run.steps.map((step) => (
        <div key={step.index}>
          <div className="flow-connector" />
          {node(step)}
        </div>
      ))}
      <div className="flow-connector" />
      <div className="flow-cap end">◉ End</div>
    </div>
  );
}

function RunNode(props: {
  step: Step;
  input: string;
  inputLabel: string;
  locked: boolean;
  isCurrent: boolean;
  busy: boolean;
  onRun: () => void;
  onApprove: () => void;
  onSavePrompt: (prompt: string) => void;
}) {
  const { step, input, inputLabel, locked, isCurrent, busy, onRun, onApprove } = props;
  const isGate = step.mode === StepMode.Gate;
  const provider = providerOf(step);

  // Auto-open the node that needs attention (current / gate / errored).
  const wantsAttention =
    isCurrent || step.status === StepStatus.Waiting || step.status === StepStatus.Error;
  const [expanded, setExpanded] = useState(wantsAttention);
  const [draft, setDraft] = useState(step.prompt);
  useEffect(() => setDraft(step.prompt), [step.prompt]);
  const dirty = draft !== step.prompt;

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
          <textarea
            className="text-input prompt-area"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
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
          {step.result && <pre className="result-box">{step.result}</pre>}
        </div>
      )}
    </div>
  );
}
