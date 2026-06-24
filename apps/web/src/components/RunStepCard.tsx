import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ImageOp,
  MediaType,
  STEP_DEFS,
  STEP_PROVIDERS,
  StepMode,
  StepStatus,
  tagColor,
  type Asset,
  type PromptMedia,
  type Provider,
  type Step,
} from '@lyra/shared';
import { StepResultModal, type StepHistoryEntry } from './StepResultModal';
import { StepEditModal } from './StepEditModal';
import { useMediaViewer } from './MediaViewer';

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
  // Bypass cache and re-run a completed step from scratch.
  onRegenerate?: () => void;
  // Promote this step's current prompt to the originating pipeline step.
  // Shown only when step.pipelineStepId is set (i.e. not a builder test run).
  onSaveToPipeline?: () => Promise<void>;
  // The run this step belongs to — needed by the result modal for downloads.
  runId: string;
  // Media this step produced (image/video). Rendered as a thumbnail strip.
  assets?: Asset[];
  // Prior runs of the same pipeline for this step (per-run result history).
  history?: StepHistoryEntry[];
  // Apply an image op (upscale/variation/outpaint) to one of this step's image
  // assets. Spawns a derived image step on the run. Omit to hide the action bar.
  onImageAction?: (assetId: string, op: ImageOp) => void;
  // When provided, the card shows an "Edit" button that opens StepEditModal
  // (the Composer-modal step editor) instead of the inline textarea.
  wsId?: string;
  onSaveModel?: (provider: Provider, model: string) => Promise<unknown> | void;
  onSaveMedia?: (media: PromptMedia[]) => Promise<unknown> | void;
}

export function RunStepCard(props: RunStepCardProps) {
  const { t } = useTranslation();
  const { step, input, inputLabel, locked, isCurrent, busy, onRun, onApprove, onRegenerate, onSaveToPipeline, runId, assets, history, onImageAction, wsId, onSaveModel, onSaveMedia } =
    props;
  const isGate = step.mode === StepMode.Gate;
  const provider = providerOf(step);
  const [showResult, setShowResult] = useState(false);
  const [editing, setEditing] = useState(false);
  // "View result" is a first-class action (decoupled from the prompt): available
  // whenever this step has produced something, or has prior runs to look back on.
  const hasResult =
    !!step.result || !!step.error || (assets?.length ?? 0) > 0 || (history?.length ?? 0) > 0;

  // Auto-open the node that needs attention (current / gate / errored).
  const wantsAttention =
    isCurrent || step.status === StepStatus.Waiting || step.status === StepStatus.Error;
  const [expanded, setExpanded] = useState(wantsAttention);
  const { open: openMedia, viewer } = useMediaViewer();

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
            <span className={`mode-tag ${isGate ? 'gate' : 'auto'}`}>{isGate ? t('run.gate') : t('run.auto')}</span>
            <span className={`badge status-${step.status}`}>{t(`run.status_${step.status}`)}</span>
            {step.cached && <span className="badge badge-cached">{t('run.cached')}</span>}
          </div>
          <div className="flow-node-sub">{step.model}</div>
        </button>
        {/* inline actions — visible even when collapsed. "View result" is a
            first-class action, independent of the prompt-editing expand. */}
        {(!locked && (step.status === StepStatus.Waiting || runnable)) || hasResult ? (
          <div className="rn-action">
            {!locked && step.status === StepStatus.Waiting && (
              <button className="btn-primary btn-inline" disabled={busy} onClick={onApprove}>
                {t('common.approve')}
              </button>
            )}
            {!locked && runnable && (
              <button className="btn-primary btn-inline" disabled={busy} onClick={onRun}>
                {t('common.run')}
              </button>
            )}
            {hasResult && (
              <button
                type="button"
                className="btn-ghost rn-view btn-inline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResult(true);
                }}
              >
                {t('run.viewResult')}
              </button>
            )}
            {!locked && step.status === StepStatus.Done && onRegenerate && (
              <button
                type="button"
                className="btn-ghost btn-inline"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
              >
                {t('run.regenerate')}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {assets && assets.length > 0 && (
        <div className="rn-assets" aria-label={t('run.generatedAssets', { count: assets.length })}>
          {assets.map((a) =>
            a.type === 'image' ? (
              <div key={a.id} className="rn-asset-wrap">
                <a className="rn-asset" href={a.url} target="_blank" rel="noreferrer" title={t('run.openFullSize')} onClick={openMedia({ url: a.url, type: a.type as MediaType })}>
                  <img src={a.thumbUrl || a.url} alt="" loading="lazy" />
                </a>
                {onImageAction && !locked && step.status === StepStatus.Done && (
                  <div className="rn-asset-ops" role="group" aria-label={t('run.imageOps')}>
                    {Object.values(ImageOp).map((op) => (
                      <button
                        key={op}
                        type="button"
                        className="rn-op-btn"
                        disabled={busy}
                        title={t(`run.imageOp_${op}`)}
                        onClick={(e) => { e.stopPropagation(); onImageAction(a.id, op); }}
                      >
                        {t(`run.imageOp_${op}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <a key={a.id} className={`rn-asset rn-asset-${a.type}`} href={a.url} target="_blank" rel="noreferrer" title={t('run.openAsset', { type: a.type })} onClick={openMedia({ url: a.url, type: a.type as MediaType })}>
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
          <div className="rn-body-actions">
            {wsId && !locked && (
              <button className="btn-ghost" disabled={busy} onClick={() => setEditing(true)}>
                {t('run.editPrompt')}
              </button>
            )}
            {locked && (
              <span className="muted" style={{ fontSize: 13 }}>
                {t('run.lockedHint', { provider })}{' '}
                <Link to="/settings" style={{ color: 'var(--primary)' }}>{t('nav.settings')}</Link>
              </span>
            )}
          </div>
          {step.error && <p className="step-error">{step.error}</p>}
        </div>
      )}
      {editing && wsId && (
        <StepEditModal
          wsId={wsId}
          stepIndex={step.index}
          prompt={step.prompt}
          media={step.media ?? []}
          provider={(step.provider ?? 'anthropic') as Provider}
          model={step.model ?? ''}
          onClose={() => setEditing(false)}
          onSavePrompt={(_, p) => Promise.resolve(props.onSavePrompt(p))}
          onSaveModel={(_, p, m) => Promise.resolve(onSaveModel?.(p, m))}
          onSaveMedia={(_, med) => Promise.resolve(onSaveMedia?.(med))}
          onSaveToPipeline={onSaveToPipeline && step.pipelineStepId
            ? async (_) => { await onSaveToPipeline(); }
            : undefined}
          onRerun={() => { onRun(); }}
          canPromote={!!step.pipelineStepId && !!onSaveToPipeline}
        />
      )}
      {showResult && (
        <StepResultModal
          runId={runId}
          step={step}
          assets={assets ?? []}
          input={input}
          history={history}
          onClose={() => setShowResult(false)}
        />
      )}
      {viewer}
    </div>
  );
}
