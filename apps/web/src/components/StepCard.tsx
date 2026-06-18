import type { CSSProperties } from 'react';
import {
  StepMode,
  tagColor,
  labelColor,
  type Provider,
  type PipelineStep,
  type Prompt,
} from '@lyra/shared';
import { EyeIcon } from '../layout/icons';
import { ProviderIcon } from './ProviderIcon';
import { useFlowCallbacks } from './flow/flowCallbacks';

export interface StepCardProps {
  step: PipelineStep;
  index: number;
  canEdit: boolean;
  prompt?: Prompt;
  labels: Parameters<typeof labelColor>[1];
  modelLabel: (p: Provider, m: string) => string;
}

// One editable step node, shared by the desktop canvas (a React Flow node) and
// the mobile pager. Pure presentation: data comes in as props, actions go out
// through the FlowCallbacks context (no closure over builder state). Reorder is
// via the ← / → actions (the old pointer-drag grip is gone — on the canvas you
// drag to reposition, and ← / → change the sequence).
export function StepCard({ step: s, index: i, canEdit, prompt: p, labels, modelLabel }: StepCardProps) {
  const cb = useFlowCallbacks();
  return (
    <div className="flow-node" style={{ '--accent': tagColor(s.name || s.promptId) } as CSSProperties}>
      <div className="flow-node-main" onClick={() => canEdit && cb.onEdit?.(i)}>
        <div className="flow-node-head">
          <span className="flow-num">{i + 1}</span>
          <span className="flow-name">{s.name}</span>
          {canEdit ? (
            <button
              type="button"
              className={`mode-tag mode-toggle ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}
              title="Toggle gate / auto"
              onClick={(e) => { e.stopPropagation(); cb.onToggleMode?.(i); }}
            >
              {s.mode === StepMode.Gate ? 'GATE' : 'AUTO'}
            </button>
          ) : (
            <span className={`mode-tag ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}>
              {s.mode === StepMode.Gate ? 'GATE' : 'AUTO'}
            </span>
          )}
          {s.fanOut?.over && (
            <span className="mode-tag fanout" title={`Fan out over the "${s.fanOut.over}" collection`}>
              FAN-OUT
            </span>
          )}
          {s.condition?.variable && (
            <span
              className="mode-tag cond"
              title={`Run only when ${s.condition.variable} ${s.condition.op}${s.condition.value ? ` ${s.condition.value}` : ''}`}
            >
              IF
            </span>
          )}
          {p && (
            <span
              className="flow-eye"
              role="button"
              tabIndex={0}
              title="View full prompt"
              onClick={(e) => { e.stopPropagation(); cb.onViewPrompt?.(p.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); cb.onViewPrompt?.(p.id); } }}
            >
              <EyeIcon width={15} height={15} />
            </span>
          )}
          {cb.onTestStep && (
            <button
              type="button"
              className="flow-test-btn"
              title="Test this step"
              onClick={(e) => {
                e.stopPropagation();
                cb.onTestStep?.(i);
              }}
            >
              Test
            </button>
          )}
        </div>
        {p?.content?.trim() && <div className="flow-node-snip">{p.content}</div>}
        <div className="flow-node-sub">
          <ProviderIcon provider={s.provider} size={14} />
          <span>{modelLabel(s.provider, s.model)}</span>
        </div>
        {p && (p.tags.length > 0 || p.createdBy?.name) && (
          <div className="flow-node-foot">
            {p.tags.slice(0, 4).map((t) => (
              <span key={t} className="tag-chip ro">
                <span className="tdot" style={{ background: labelColor(t, labels) }} />
                {t}
              </span>
            ))}
            {p.createdBy?.name && (
              <span className="flow-by">
                <span className="flow-avatar">{p.createdBy.name.charAt(0).toUpperCase()}</span>
                {p.createdBy.name}
              </span>
            )}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flow-node-actions">
          <button className="icon-mini" title="Move earlier" onClick={() => cb.onMove?.(i, -1)}>←</button>
          <button className="icon-mini" title="Move later" onClick={() => cb.onMove?.(i, 1)}>→</button>
          <button className="icon-mini danger" title="Remove" onClick={() => cb.onRemove?.(i)}>×</button>
        </div>
      )}
    </div>
  );
}
