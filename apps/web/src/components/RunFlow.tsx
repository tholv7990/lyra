import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOp, type Asset, type PromptMedia, type Provider, type Run, type Step } from '@lyra/shared';
import { FlowPagerControls, useFlowPager } from './FlowPager';
import { RunStepCard, providerOf } from './RunStepCard';
import type { StepHistoryEntry } from './StepResultModal';
import { buildRunGraph } from './flow/buildGraph';

const FlowCanvas = lazy(() => import('./FlowCanvas'));

interface RunFlowProps {
  run: Run;
  busy: boolean;
  hasKey: (provider: string) => boolean;
  onRunStep: (index: number) => void;
  onApprove: (index: number) => void;
  onSavePrompt: (index: number, prompt: string) => void;
  onRegenerate?: (index: number) => void;
  onImageAction?: (index: number, assetId: string, op: ImageOp) => void;
  mobileLayout?: 'pager' | 'flow';
  // Media produced by the run's steps (from GET /runs/:id/assets), shown per step.
  assets?: Asset[];
  // Per-run result history for a step (prior runs of the same pipeline). When
  // omitted (e.g. the builder test-run), the result modal shows the current run only.
  historyForStep?: (index: number) => StepHistoryEntry[];
  // Passed through to RunStepCard to enable the StepEditModal Composer editor.
  wsId?: string;
  onSaveModel?: (index: number, provider: Provider, model: string) => void;
  onSaveMedia?: (index: number, media: PromptMedia[]) => void;
}

// The unified run view (n8n-style): the pipeline rendered as the same vertical
// flow as the builder (Start → nodes → End), lit up with live per-step status.
// Each node shows its status, an inline Run/Approve action, and — when expanded —
// the (editable) prompt and the result/error.
export function RunFlow({
  run,
  busy,
  hasKey,
  onRunStep,
  onApprove,
  onSavePrompt,
  onRegenerate,
  onImageAction,
  mobileLayout = 'pager',
  assets = [],
  historyForStep,
  wsId,
  onSaveModel,
  onSaveMedia,
}: RunFlowProps) {
  const { t } = useTranslation();
  const pager = useFlowPager(run.steps.length);
  const { isMobile, setPage } = pager;
  const assetsFor = (index: number) => assets.filter((a) => a.stepIndex === index);

  // On mobile, follow the active step as the run progresses.
  useEffect(() => {
    if (isMobile && (run.status === 'running' || run.status === 'awaiting_gate')) {
      setPage(run.currentStep + 1);
    }
  }, [isMobile, run.status, run.currentStep, setPage]);

  const node = (step: Step) => (
    <RunStepCard
      key={step.index}
      step={step}
      // each node's input = the previous step's output (the {note} seeds step 1)
      input={step.index > 0 ? run.steps[step.index - 1]?.result ?? '' : run.context?.note ?? ''}
      inputLabel={step.index > 0 ? t('run.inputFromPrevious') : t('run.inputNote')}
      locked={!hasKey(providerOf(step))}
      isCurrent={step.index === run.currentStep && run.status !== 'done'}
      busy={busy}
      onRun={() => onRunStep(step.index)}
      onApprove={() => onApprove(step.index)}
      onSavePrompt={(p) => onSavePrompt(step.index, p)}
      onRegenerate={onRegenerate ? () => onRegenerate(step.index) : undefined}
      onImageAction={onImageAction ? (assetId, op) => onImageAction(step.index, assetId, op) : undefined}
      runId={run.id}
      assets={assetsFor(step.index)}
      history={historyForStep?.(step.index)}
      wsId={wsId}
      onSaveModel={onSaveModel ? (p, m) => onSaveModel(step.index, p, m) : undefined}
      onSaveMedia={onSaveMedia ? (med) => onSaveMedia(step.index, med) : undefined}
    />
  );

  if (isMobile && mobileLayout === 'flow') {
    return (
      <div className="flow run-flow flow-mobile-full">
        <div className="flow-cap">● {t('common.start')}</div>
        <div className="flow-connector" aria-hidden />
        {run.steps.map((step) => (
          <div className="run-flow-segment" key={step.index}>
            {node(step)}
            <div className="flow-connector" aria-hidden />
          </div>
        ))}
        <div className="flow-cap end">◎ {t('common.end')}</div>
      </div>
    );
  }

  if (isMobile) {
    const { page } = pager;
    const step = page >= 1 && page <= run.steps.length ? run.steps[page - 1] : null;
    return (
      <div className="flow run-flow pager">
        {page === 0 && <div className="flow-cap">● {t('common.start')}</div>}
        {step && node(step)}
        {page === run.steps.length + 1 && <div className="flow-cap end">◉ {t('common.end')}</div>}
        <FlowPagerControls pager={pager} stepCount={run.steps.length} />
      </div>
    );
  }

  const graph = buildRunGraph({ run, hasKey, assets, historyForStep });
  return (
    <Suspense fallback={<div className="flow-canvas loading">{t('common.loadingCanvas')}</div>}>
      <FlowCanvas graph={graph} callbacks={{ busy, onRunStep, onApprove, onSavePrompt, onRegenerate, onImageAction }} />
    </Suspense>
  );
}
