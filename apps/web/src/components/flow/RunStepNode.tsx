import { Handle, Position, type NodeProps } from '@xyflow/react';
import { RunStepCard } from '../RunStepCard';
import { useFlowCallbacks } from './flowCallbacks';
import type { RunNodeData } from './buildGraph';

export function RunStepNode({ data }: NodeProps) {
  const d = data as RunNodeData;
  const cb = useFlowCallbacks();
  const i = d.step.index;
  return (
    <div className="flow-rf-node">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <RunStepCard
        step={d.step}
        input={d.input}
        inputLabel={d.inputLabel}
        locked={d.locked}
        isCurrent={d.isCurrent}
        busy={cb.busy}
        onRun={() => cb.onRunStep?.(i)}
        onApprove={() => cb.onApprove?.(i)}
        onSavePrompt={(p) => cb.onSavePrompt?.(i, p)}
        vars={d.vars}
        stepNames={d.stepNames}
      />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
