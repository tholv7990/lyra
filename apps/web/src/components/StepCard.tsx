import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StepMode,
  tagColor,
  type Provider,
  type PipelineStep,
  type Prompt,
} from '@lyra/shared';
import { EyeIcon, PlayIcon, XIcon } from '../layout/icons';
import { ProviderIcon } from './ProviderIcon';
import { useFlowCallbacks } from './flow/flowCallbacks';

export interface StepCardProps {
  step: PipelineStep;
  index: number;
  canEdit: boolean;
  prompt?: Prompt;
  labels: unknown;
  modelLabel: (p: Provider, m: string) => string;
  // The step's bound prompt was deleted/inactive — flag it so it can be re-picked.
  promptMissing?: boolean;
  // No prompt bound yet (e.g. an AI "gap" step) — flag it so the user picks one.
  needsPrompt?: boolean;
}

// One editable step node (the design's vertical card), shared by the desktop
// canvas (a React Flow node) and the mobile pager. Pure presentation: data comes
// in as props, actions go out through the FlowCallbacks context. The resting card
// matches the design (colored number · name · mode badge · 2-line prompt ·
// provider·model pill · footer = creator + eye/Test/delete). The ← / → reorder
// controls float top-right and reveal on hover (always shown on touch, since the
// canvas drag repositions but doesn't change the run sequence).
export function StepCard({ step: s, index: i, canEdit, prompt: p, modelLabel, promptMissing, needsPrompt }: StepCardProps) {
  const { t } = useTranslation();
  const cb = useFlowCallbacks();
  const broken = !!promptMissing || !!needsPrompt;
  return (
    <div
      className={`flow-node step-edit${broken ? ' broken' : ''}`}
      style={{ '--accent': tagColor(s.name || s.promptId || String(i)) } as CSSProperties}
    >
      <div className="se-body" onClick={() => canEdit && cb.onEdit?.(i)}>
        <div className="se-head">
          <span className="flow-num">{i + 1}</span>
          <span className="flow-name">{s.name}</span>
          {canEdit ? (
            <button
              type="button"
              className={`mode-tag mode-toggle ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}
              title={t('run.toggleGateAuto')}
              onClick={(e) => { e.stopPropagation(); cb.onToggleMode?.(i); }}
            >
              {s.mode === StepMode.Gate ? t('run.gate') : t('run.auto')}
            </button>
          ) : (
            <span className={`mode-tag ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}>
              {s.mode === StepMode.Gate ? t('run.gate') : t('run.auto')}
            </span>
          )}
          {s.fanOut?.over && (
            <span className="mode-tag fanout" title={t('run.fanOutOver', { collection: s.fanOut.over })}>
              {t('run.fanOut')}
            </span>
          )}
          {s.condition?.variable && (
            <span
              className="mode-tag cond"
              title={t('run.conditionTitle', {
                variable: s.condition.variable,
                op: s.condition.op,
                value: s.condition.value ? ` ${s.condition.value}` : '',
              })}
            >
              IF
            </span>
          )}
          {promptMissing && (
            <span className="mode-tag missing" title={t('run.promptDeletedTitle')}>
              ⚠ {t('run.promptDeleted')}
            </span>
          )}
          {needsPrompt && !promptMissing && (
            <span className="mode-tag missing" title={t('run.needsPromptTitle')}>
              ⚠ {t('run.needsPrompt')}
            </span>
          )}
        </div>

        {p?.content?.trim() && <p className="se-snip">{p.content}</p>}
        {promptMissing && <p className="se-snip broken-hint">{t('run.promptDeletedHint')}</p>}
        {needsPrompt && !promptMissing && <p className="se-snip broken-hint">{t('run.needsPromptHint')}</p>}

        <div className="se-pills">
          <span className="se-model">
            <ProviderIcon provider={s.provider} size={16} />
            {modelLabel(s.provider, s.model)}
          </span>
        </div>
      </div>

      <div className="se-foot">
        {p?.createdBy?.name ? (
          <span className="flow-by">
            <span className="flow-avatar">{p.createdBy.name.charAt(0).toUpperCase()}</span>
            <span className="flow-by-name">{p.createdBy.name}</span>
          </span>
        ) : (
          <span />
        )}
        <div className="se-actions">
          {canEdit && (
            <span className="se-move">
              <button type="button" className="se-move-btn" title={t('run.moveEarlier')} aria-label={t('run.moveEarlier')} onClick={(e) => { e.stopPropagation(); cb.onMove?.(i, -1); }}>←</button>
              <button type="button" className="se-move-btn" title={t('run.moveLater')} aria-label={t('run.moveLater')} onClick={(e) => { e.stopPropagation(); cb.onMove?.(i, 1); }}>→</button>
            </span>
          )}
          {p && (
            <button
              type="button"
              className="se-btn"
              title={t('run.viewFullPrompt')}
              aria-label={t('run.viewFullPrompt')}
              onClick={(e) => { e.stopPropagation(); cb.onViewPrompt?.(p.id); }}
            >
              <EyeIcon width={14} height={14} />
            </button>
          )}
          {cb.onTestStep && (
            <button
              type="button"
              className="se-btn se-test"
              title={t('run.testThisStep')}
              onClick={(e) => { e.stopPropagation(); cb.onTestStep?.(i); }}
            >
              <PlayIcon width={11} height={11} /> {t('run.test')}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="se-btn se-del"
              title={t('common.remove')}
              aria-label={t('common.remove')}
              onClick={(e) => { e.stopPropagation(); cb.onRemove?.(i); }}
            >
              <XIcon width={13} height={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
