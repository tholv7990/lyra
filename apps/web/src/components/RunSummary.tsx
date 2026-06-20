import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  running: 'var(--warning)',
  waiting: 'var(--warning)',
  done: 'var(--success)',
  error: 'var(--danger)',
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
  const { t } = useTranslation();
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
              {t('run.stepFailed', {
                n: errored.index + 1,
                name: errored.name ? ` · ${errored.name}` : '',
              })}
            </strong>
            <span>{errored.error ?? t('run.stepIncomplete')}</span>
          </div>
          <button
            className="btn-ghost run-error-retry btn-inline"
            disabled={busy}
            onClick={() => onRetry(errored.index)}
          >
            ↻ {t('run.retryStep')}
          </button>
        </div>
      )}

      {finalResult && (
        <div className="run-final">
          <div className="run-final-head">
            <h3>{t('run.finalResult', { name: last?.name ? ` · ${last.name}` : '' })}</h3>
            <div className="run-final-actions">
              <button className="btn-ghost btn-inline" onClick={() => copy(finalResult)}>
                {copied ? t('common.copied') : t('common.copy')}
              </button>
              <button
                className="btn-ghost btn-inline"
                onClick={() => download(finalResult, `${(run.pipelineName ?? 'run').replace(/\s+/g, '-')}.md`)}
              >
                {t('common.download')}
              </button>
            </div>
          </div>
          <div className="run-final-body">
            <Markdown>{finalResult}</Markdown>
          </div>
        </div>
      )}

      <div className="run-timeline">
        <div className="run-timeline-head">{t('run.runLog')}</div>
        {run.steps.map((s) => {
          const dur = fmtDuration(s.startedAt, s.finishedAt);
          const cost = fmtCost(s.usage?.costUsd);
          return (
            <div key={s.index} className={`run-tl-row${s.status === StepStatus.Error ? ' err' : ''}`}>
              <span className="run-tl-dot" style={{ background: STATUS_DOT[s.status] ?? 'var(--ink-tertiary)' }} />
              <span className="run-tl-name">
                {s.index + 1}. {s.name ?? t('run.stepFallback', { n: s.index + 1 })}
              </span>
              <span className={`run-tl-status st-${s.status}`}>{t(`run.status_${s.status}`, s.status)}</span>
              <span className="run-tl-meta">
                {dur && <span>{dur}</span>}
                {cost && <span>{cost}</span>}
                {s.usage?.tokens != null && <span>{t('run.tokenShort', { count: s.usage.tokens.toLocaleString() })}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
