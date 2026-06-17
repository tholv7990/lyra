import { useState } from 'react';
import { StepStatus, type Run } from '@lyra/shared';
import { Markdown } from './Markdown';

function fmtDuration(a?: string, b?: string) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function fmtCost(c?: number) {
  if (c == null) return null;
  return `$${c.toFixed(c < 0.01 ? 4 : 2)}`;
}

const STATUS_DOT: Record<string, string> = {
  idle: 'var(--ink-tertiary)',
  running: '#d4a72c',
  waiting: '#d4a72c',
  done: '#2da44e',
  error: '#e5484d',
};
const STATUS_TEXT: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting: 'Awaiting approval',
  done: 'Done',
  error: 'Error',
};

// Below the run canvas: surfaces the things you actually run a pipeline for —
// the final deliverable, and a clear log of what each step did (incl. failures).
export function RunSummary({
  run,
  busy,
  onRetry,
}: {
  run: Run;
  busy: boolean;
  onRetry: (index: number) => void;
}) {
  const [copied, setCopied] = useState(false);

  const errored = run.steps.find((s) => s.status === StepStatus.Error || !!s.error);
  const last = run.steps[run.steps.length - 1];
  const finalResult =
    last && last.status === StepStatus.Done && last.result?.trim() ? last.result : undefined;
  const hasActivity = run.steps.some((s) => s.status !== StepStatus.Idle || s.result || s.error);
  if (!hasActivity) return null;

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const download = (text: string, name: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="run-summary">
      {errored && (
        <div className="run-error">
          <div className="run-error-main">
            <strong>
              Step {errored.index + 1}
              {errored.name ? ` · ${errored.name}` : ''} failed
            </strong>
            <span>{errored.error ?? 'The step did not complete.'}</span>
          </div>
          <button
            className="btn-ghost run-error-retry"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={busy}
            onClick={() => onRetry(errored.index)}
          >
            ↻ Retry step
          </button>
        </div>
      )}

      {finalResult && (
        <div className="run-final">
          <div className="run-final-head">
            <h3>Final result{last?.name ? ` · ${last.name}` : ''}</h3>
            <div className="run-final-actions">
              <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} onClick={() => copy(finalResult)}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="btn-ghost"
                style={{ width: 'auto', marginTop: 0 }}
                onClick={() => download(finalResult, `${(run.pipelineName ?? 'run').replace(/\s+/g, '-')}.md`)}
              >
                Download
              </button>
            </div>
          </div>
          <div className="run-final-body">
            <Markdown>{finalResult}</Markdown>
          </div>
        </div>
      )}

      <div className="run-timeline">
        <div className="run-timeline-head">Run log</div>
        {run.steps.map((s) => {
          const dur = fmtDuration(s.startedAt, s.finishedAt);
          const cost = fmtCost(s.usage?.costUsd);
          return (
            <div key={s.index} className={`run-tl-row${s.status === StepStatus.Error ? ' err' : ''}`}>
              <span className="run-tl-dot" style={{ background: STATUS_DOT[s.status] ?? 'var(--ink-tertiary)' }} />
              <span className="run-tl-name">
                {s.index + 1}. {s.name ?? `Step ${s.index + 1}`}
              </span>
              <span className={`run-tl-status st-${s.status}`}>{STATUS_TEXT[s.status] ?? s.status}</span>
              <span className="run-tl-meta">
                {dur && <span>{dur}</span>}
                {cost && <span>{cost}</span>}
                {s.usage?.tokens != null && <span>{s.usage.tokens.toLocaleString()} tok</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
