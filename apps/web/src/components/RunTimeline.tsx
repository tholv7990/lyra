import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BUILTIN_VAR_LABELS, ImageOp, MediaType, StepMode, StepStatus, promptVarsForStep, type Asset, type PromptMedia, type Provider, type Run, type Step, isResearchRun, groupByResearchPhase, type ResearchPhaseGroup } from '@lyra/shared';
import { ProviderIcon } from './ProviderIcon';
import { PencilIcon, PlayIcon, RefreshIcon } from '../layout/icons';
import { providerOf, stepTitle } from './RunStepCard';
import { StepResultModal, type StepHistoryEntry } from './StepResultModal';
import { StepEditModal } from './StepEditModal';
import { useMediaViewer } from './MediaViewer';
import './runtimeline.css';

interface RunTimelineProps {
  run: Run;
  busy: boolean;
  hasKey: (provider: string) => boolean;
  onRunStep: (index: number) => void;
  onApprove: (index: number) => void;
  onReject?: (index: number) => void;
  onSavePrompt: (index: number, prompt: string) => Promise<unknown> | void;
  onSaveModel?: (index: number, provider: Provider, model: string) => Promise<unknown> | void;
  onSaveMedia?: (index: number, media: PromptMedia[]) => Promise<unknown> | void;
  onRegenerate?: (index: number) => void;
  onSaveToPipeline?: (index: number) => Promise<void>;
  onImageAction?: (index: number, assetId: string, op: ImageOp) => void;
  assets?: Asset[];
  historyForStep?: (index: number) => StepHistoryEntry[];
  wsId?: string;
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
  onReject,
  onSavePrompt,
  onSaveModel,
  onSaveMedia,
  onRegenerate,
  onSaveToPipeline,
  assets = [],
  historyForStep,
  onImageAction,
  wsId,
}: RunTimelineProps) {
  const { t } = useTranslation();
  // Steps auto-open when they need attention (current / waiting / error).
  const initialOpen = new Set(
    run.steps
      .filter((s) => s.status === StepStatus.Waiting || s.status === StepStatus.Error || (s.index === run.currentStep && run.status !== 'done'))
      .map((s) => s.index),
  );
  const [open, setOpen] = useState<Set<number>>(initialOpen);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [resultFor, setResultFor] = useState<number | null>(null);
  const [savedToPipeline, setSavedToPipeline] = useState<number | null>(null);
  const { open: openMedia, viewer } = useMediaViewer();

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const editingStep = editingIndex !== null ? run.steps[editingIndex] ?? null : null;

  const renderStep = (step: Step) => {
    const isGate = step.mode === StepMode.Gate;
    const provider = providerOf(step);
    const locked = !hasKey(provider);
    const isCurrent = step.index === run.currentStep && run.status !== 'done';
    const runnable = isCurrent && step.status !== StepStatus.Done && step.status !== StepStatus.Waiting;
    const canEditStep = step.status !== StepStatus.Waiting && step.status !== StepStatus.Running && !locked;
    const queued = step.status === StepStatus.Idle || step.status === StepStatus.Queued;
    const stepAssets = assets.filter((a) => a.stepIndex === step.index);
    const history = historyForStep?.(step.index) ?? [];
    const hasResult = !!step.result || !!step.error || stepAssets.length > 0 || history.length > 0;
    const exp = open.has(step.index);
    const last = step.index === run.steps.length - 1;

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
            {step.cached && <span className="rt-cached">{t('run.cached')}</span>}
            <span className="rt-flex" />
            {/* Compact icon controls — view output · edit prompt · run/regenerate.
                Each carries a title + aria-label; the row data gets the width. */}
            {(hasResult || canEditStep || (runnable && !locked) || (step.status === StepStatus.Done && !locked && onRegenerate)) && (
              <div className="rt-acts">
                {canEditStep && (
                  <button type="button" className="rt-ibtn" disabled={busy} title={t('run.editPrompt')} aria-label={t('run.editPrompt')} onClick={() => setEditingIndex(step.index)}>
                    <PencilIcon width={14} height={14} />
                  </button>
                )}
                {runnable && !locked && (
                  <button type="button" className="rt-ibtn run" disabled={busy} title={t('common.run')} aria-label={t('common.run')} onClick={() => onRunStep(step.index)}>
                    <PlayIcon width={13} height={13} />
                  </button>
                )}
                {step.status === StepStatus.Done && !locked && onRegenerate && (
                  <button type="button" className="rt-ibtn" disabled={busy} title={t('run.regenerate')} aria-label={t('run.regenerate')} onClick={() => onRegenerate(step.index)}>
                    <RefreshIcon width={14} height={14} />
                  </button>
                )}
                {hasResult && (
                  <button type="button" className="rt-ibtn rt-chev" aria-expanded={exp} title={exp ? t('run.collapse') : t('run.expand')} aria-label={exp ? t('run.collapse') : t('run.expand')} onClick={() => toggle(step.index)}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: exp ? 'none' : 'rotate(-90deg)' }}><path d="m4.5 6.5 3.5 3 3.5-3" /></svg>
                  </button>
                )}
              </div>
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
                      <div key={a.id} className="rn-asset-wrap">
                        <a className="rt-asset" href={a.url} target="_blank" rel="noreferrer" onClick={openMedia({ url: a.url, type: a.type as MediaType })}><img src={a.thumbUrl || a.url} alt="" loading="lazy" /></a>
                        {onImageAction && !locked && step.status === StepStatus.Done && (
                          <div className="rn-asset-ops" role="group" aria-label={t('run.imageOps')}>
                            {Object.values(ImageOp).map((op) => (
                              <button
                                key={op}
                                type="button"
                                className="rn-op-btn"
                                disabled={busy}
                                title={t(`run.imageOp_${op}`)}
                                onClick={(e) => { e.stopPropagation(); onImageAction(step.index, a.id, op); }}
                              >
                                {t(`run.imageOp_${op}`)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <a key={a.id} className="rt-asset glyph" href={a.url} target="_blank" rel="noreferrer" onClick={openMedia({ url: a.url, type: a.type as MediaType })}><span aria-hidden>{a.type === 'video' ? '▶' : '♪'}</span></a>
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

          {step.status === StepStatus.Waiting && !locked && (
            <div className="rt-gate">
              {step.reviewIssues && step.reviewIssues.length > 0 && (
                <div className="rt-review-issues">
                  <div className="rt-review-issues-title">{t('run.reviewIssuesTitle')}</div>
                  <ul className="rt-review-issues-list">
                    {step.reviewIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
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
                {onReject && (
                  <button type="button" className="btn-ghost btn-inline btn-sm rt-reject" disabled={busy} onClick={() => onReject(step.index)}>
                    {t('run.reject')}
                  </button>
                )}
                <button type="button" className="btn-ghost btn-inline btn-sm" disabled={busy} onClick={() => setEditingIndex(step.index)}>
                  {t('run.editRerun')}
                </button>
              </div>
            </div>
          )}

          {savedToPipeline === step.index && (
            <div className="rt-saved-confirm" role="status" aria-live="polite">
              {t('run.savedToPipelineConfirm')}
            </div>
          )}

          {step.status === StepStatus.Running && step.jobId && (
            <div className="rt-progress">
              <div className="rt-progress-bar"><span style={{ transform: `scaleX(${(step.progress ?? 0) / 100})` }} /></div>
              <span className="rt-progress-label">{t('run.generatingVideo')} {step.progress ?? 0}%</span>
            </div>
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
  };

  const phaseGlyphStatus = (steps: Step[]): StepStatus => {
    if (steps.some((s) => s.status === StepStatus.Error)) return StepStatus.Error;
    if (steps.every((s) => s.status === StepStatus.Done || s.status === StepStatus.Skipped)) return StepStatus.Done;
    if (run.status !== 'done' && steps.some((s) => s.index === run.currentStep || s.status === StepStatus.Running || s.status === StepStatus.Waiting)) return StepStatus.Running;
    return StepStatus.Idle;
  };
  const phaseLabel: Record<ResearchPhaseGroup['key'], { name: string; sub: string }> = {
    find: { name: t('run.phaseFind'), sub: t('run.phaseFindSub') },
    validate: { name: t('run.phaseValidate'), sub: t('run.phaseValidateSub') },
    economics: { name: t('run.phaseEconomics'), sub: t('run.phaseEconomicsSub') },
    decide: { name: t('run.phaseDecide'), sub: t('run.phaseDecideSub') },
  };

  const research = isResearchRun(run.steps);
  return (
    <div className="rt">
      {research
        ? groupByResearchPhase(run.steps).map((group) => {
            const done = group.steps.filter((s) => s.status === StepStatus.Done || s.status === StepStatus.Skipped).length;
            const gs = phaseGlyphStatus(group.steps);
            return (
              <div className="rt-phase" key={group.key}>
                <div className={`rt-phase-head status-${gs}`}>
                  <span className="rt-phase-ico"><StatusGlyph status={gs} /></span>
                  <span className="rt-phase-num">{group.phase}</span>
                  <span className="rt-phase-name">{phaseLabel[group.key].name}</span>
                  <span className="rt-phase-sub">{phaseLabel[group.key].sub}</span>
                  <span className="rt-phase-count">{done}/{group.steps.length}</span>
                </div>
                {group.steps.map(renderStep)}
              </div>
            );
          })
        : run.steps.map(renderStep)}

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
      {editingIndex !== null && editingStep && wsId && (
        <StepEditModal
          wsId={wsId}
          stepIndex={editingIndex}
          prompt={editingStep.prompt}
          media={editingStep.media ?? []}
          provider={(editingStep.provider ?? 'anthropic') as Provider}
          model={editingStep.model ?? ''}
          onClose={() => setEditingIndex(null)}
          onSavePrompt={(i, p) => Promise.resolve(onSavePrompt(i, p))}
          onSaveModel={(i, p, m) => Promise.resolve(onSaveModel?.(i, p, m))}
          onSaveMedia={(i, med) => Promise.resolve(onSaveMedia?.(i, med))}
          onSaveToPipeline={onSaveToPipeline ? async (i) => {
            await onSaveToPipeline(i);
            setSavedToPipeline(i);
            setTimeout(() => setSavedToPipeline(null), 4000);
          } : undefined}
          onRerun={onRunStep}
          canPromote={!!editingStep.pipelineStepId && !!onSaveToPipeline}
          vars={promptVarsForStep(run.steps, editingIndex, run.variables ?? {}, BUILTIN_VAR_LABELS)}
          stepNames={run.steps.map((s) => s.name ?? '')}
        />
      )}
      {viewer}
    </div>
  );
}
