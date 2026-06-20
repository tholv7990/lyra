import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StepMode, StepStatus, type Asset, type Run, type Step } from '@lyra/shared';
import { ProviderIcon } from './ProviderIcon';
import { providerOf, stepTitle } from './RunStepCard';
import { StepResultModal, type StepHistoryEntry } from './StepResultModal';
import './runtimeline.css';

interface RunTimelineProps {
  run: Run;
  busy: boolean;
  hasKey: (provider: string) => boolean;
  onRunStep: (index: number) => void;
  onApprove: (index: number) => void;
  onSavePrompt: (index: number, prompt: string) => void;
  assets?: Asset[];
  historyForStep?: (index: number) => StepHistoryEntry[];
}

// Per-status timeline glyph (matches the design's vertical step rail).
function StatusGlyph({ status }: { status: StepStatus }) {
  const s = { width: 20, height: 20, viewBox: '0 0 16 16', fill: 'none' } as const;
  switch (status) {
    case StepStatus.Done:
      return (
        <svg {...s}><circle cx="8" cy="8" r="7" fill="var(--success)" /><path d="M5 8.2 7 10.2 11 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case StepStatus.Running:
      return (
        <svg {...s}><circle cx="8" cy="8" r="6" stroke="var(--primary)" strokeWidth="1.6" /><path d="M8 8V2.6A5.4 5.4 0 0 1 8 13.4Z" fill="var(--primary)" /></svg>
      );
    case StepStatus.Waiting:
      return (
        <svg {...s}><circle cx="8" cy="8" r="6.4" stroke="var(--primary)" strokeWidth="1.6" /><path d="M6.4 5.8v4.4M9.6 5.8v4.4" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" /></svg>
      );
    case StepStatus.Error:
      return (
        <svg {...s}><circle cx="8" cy="8" r="6.4" stroke="var(--danger)" strokeWidth="1.6" /><path d="M6 6l4 4M10 6l-4 4" stroke="var(--danger)" strokeWidth="1.6" strokeLinecap="round" /></svg>
      );
    case StepStatus.Skipped:
      return (
        <svg {...s}><circle cx="8" cy="8" r="6" stroke="var(--ink-tertiary)" strokeWidth="1.5" /><path d="M5.5 8h5" stroke="var(--ink-tertiary)" strokeWidth="1.5" strokeLinecap="round" /></svg>
      );
    default: // idle / queued
      return (
        <svg {...s}><circle cx="8" cy="8" r="6" stroke="var(--ink-tertiary)" strokeWidth="1.5" strokeDasharray="2.4 2" /></svg>
      );
  }
}

// The design's run-step timeline: a vertical rail of status glyphs + connectors,
// each step showing its provider·model, a Gated pill, an inline output toggle, the
// gate panel (Approve & continue / Edit & rerun), and a queued hint. Reuses the run
// actions; "View full output" opens the shared result modal (history + downloads).
export function RunTimeline({
  run,
  busy,
  hasKey,
  onRunStep,
  onApprove,
  onSavePrompt,
  assets = [],
  historyForStep,
}: RunTimelineProps) {
  const { t } = useTranslation();
  // Steps auto-open when they need attention (current / waiting / error).
  const initialOpen = new Set(
    run.steps
      .filter((s) => s.status === StepStatus.Waiting || s.status === StepStatus.Error || (s.index === run.currentStep && run.status !== 'done'))
      .map((s) => s.index),
  );
  const [open, setOpen] = useState<Set<number>>(initialOpen);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [resultFor, setResultFor] = useState<number | null>(null);

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const startEdit = (step: Step) => { setDraft(step.prompt); setEditing(step.index); };

  return (
    <div className="rt">
      {run.steps.map((step, i) => {
        const isGate = step.mode === StepMode.Gate;
        const provider = providerOf(step);
        const locked = !hasKey(provider);
        const isCurrent = step.index === run.currentStep && run.status !== 'done';
        const runnable = isCurrent && step.status !== StepStatus.Done && step.status !== StepStatus.Waiting;
        const queued = step.status === StepStatus.Idle || step.status === StepStatus.Queued;
        const stepAssets = assets.filter((a) => a.stepIndex === step.index);
        const history = historyForStep?.(step.index) ?? [];
        const hasResult = !!step.result || !!step.error || stepAssets.length > 0 || history.length > 0;
        const exp = open.has(step.index);
        const last = i === run.steps.length - 1;

        return (
          <div className={`rt-step status-${step.status}`} key={step.index}>
            <div className="rt-rail">
              <span className="rt-ico"><StatusGlyph status={step.status} /></span>
              {!last && <span className="rt-line" />}
            </div>

            <div className="rt-content">
              <div className="rt-head">
                <span className={`rt-name${queued ? ' muted' : ''}`}>{stepTitle(step)}</span>
                {step.provider && (
                  <span className="rt-model">
                    <ProviderIcon provider={step.provider} size={14} /> {step.model}
                  </span>
                )}
                {isGate && <span className="rt-gated">{t('run.gated')}</span>}
                <span className="rt-flex" />
                {hasResult && (
                  <button type="button" className="rt-toggle" onClick={() => toggle(step.index)}>
                    {exp ? t('run.hideOutput') : t('run.viewOutput')}
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ transform: exp ? 'rotate(180deg)' : 'none' }} aria-hidden><path d="m4.5 6.5 3.5 3 3.5-3" /></svg>
                  </button>
                )}
              </div>

              {hasResult && exp && (
                <div className="rt-out">
                  {step.error ? (
                    <div className="rt-out-text err">{step.error}</div>
                  ) : step.result ? (
                    <div className="rt-out-text">{step.result}</div>
                  ) : null}
                  {stepAssets.length > 0 && (
                    <div className="rt-assets">
                      {stepAssets.map((a) =>
                        a.type === 'image' ? (
                          <a key={a.id} className="rt-asset" href={a.url} target="_blank" rel="noreferrer"><img src={a.thumbUrl || a.url} alt="" loading="lazy" /></a>
                        ) : (
                          <a key={a.id} className="rt-asset glyph" href={a.url} target="_blank" rel="noreferrer"><span aria-hidden>{a.type === 'video' ? '▶' : '♪'}</span></a>
                        ),
                      )}
                    </div>
                  )}
                  <div className="rt-out-foot">
                    {history.length > 0 && (
                      <span className="rt-across">
                        <span className="rt-across-label">{t('run.acrossRuns')}</span>
                        {history.slice(0, 4).map((h, j) => (
                          <span key={h.runId} className={`rt-across-item status-${h.status}`} title={new Date(h.createdAt).toLocaleString()}>
                            <span className="rt-across-dot" />#{history.length - j}
                          </span>
                        ))}
                      </span>
                    )}
                    <button type="button" className="txt-btn rt-full" onClick={() => setResultFor(step.index)}>{t('run.viewFull')}</button>
                  </div>
                </div>
              )}

              {step.status === StepStatus.Waiting && !locked && editing !== step.index && (
                <div className="rt-gate">
                  <div className="rt-gate-top">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 1.6 14 4.4v3.8c0 3.4-2.5 5.6-6 6.6-3.5-1-6-3.2-6-6.6V4.4Z" /><path d="M8 6v2.6M8 10.8h.01" /></svg>
                    <div>
                      <div className="rt-gate-title">{t('run.gatedTitle')}</div>
                      <div className="rt-gate-sub">{t('run.gatedSub')}</div>
                    </div>
                  </div>
                  <div className="rt-gate-actions">
                    <button type="button" className="btn-primary btn-inline btn-sm" disabled={busy} onClick={() => onApprove(step.index)}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M6.16 11.1 3.3 8.24a.9.9 0 0 1 1.27-1.27l2.18 2.18 4.65-4.66a.9.9 0 1 1 1.28 1.28l-5.3 5.3a.9.9 0 0 1-1.27 0Z" /></svg>
                      {t('run.approveContinue')}
                    </button>
                    <button type="button" className="btn-ghost btn-inline btn-sm" disabled={busy} onClick={() => startEdit(step)}>
                      {t('run.editRerun')}
                    </button>
                  </div>
                </div>
              )}

              {editing === step.index && (
                <div className="rt-edit">
                  <textarea className="text-input" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="rt-edit-actions">
                    <button type="button" className="btn-primary btn-inline btn-sm" disabled={busy} onClick={() => { onSavePrompt(step.index, draft); onRunStep(step.index); setEditing(null); }}>
                      {t('run.saveRerun')}
                    </button>
                    <button type="button" className="btn-ghost btn-inline btn-sm" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                  </div>
                </div>
              )}

              {runnable && !locked && editing !== step.index && (
                <button type="button" className="btn-primary btn-inline btn-sm rt-run" disabled={busy} onClick={() => onRunStep(step.index)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M4.5 3.2 12 8l-7.5 4.8Z" /></svg>
                  {t('common.run')}
                </button>
              )}

              {queued && !runnable && (
                <div className="rt-queued">{t('run.queuedNote')}</div>
              )}

              {locked && (
                <span className="muted rt-locked">
                  {t('run.lockedHint', { provider })}{' '}
                  <Link to="/settings" style={{ color: 'var(--primary)' }}>{t('nav.settings')}</Link>
                </span>
              )}
            </div>
          </div>
        );
      })}

      {resultFor !== null && run.steps[resultFor] && (
        <StepResultModal
          runId={run.id}
          step={run.steps[resultFor]}
          assets={assets.filter((a) => a.stepIndex === resultFor)}
          input={resultFor > 0 ? run.steps[resultFor - 1]?.result ?? '' : run.context?.note ?? ''}
          history={historyForStep?.(resultFor)}
          onClose={() => setResultFor(null)}
        />
      )}
    </div>
  );
}
