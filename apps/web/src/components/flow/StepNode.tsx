import { Handle, Position, type NodeProps } from '@xyflow/react';
import { StepCard } from '../StepCard';
import { useFlowEditData } from './flowCallbacks';
import type { EditNodeData } from './buildGraph';

export function StepNode({ data }: NodeProps) {
  const d = data as EditNodeData;
  const edit = useFlowEditData();
  const prompt = edit?.prompts.find((p) => p.id === d.step.promptId);
  const promptMissing = !!d.step.promptId && !!edit?.missing?.has(d.step.promptId);
  return (
    <div className="flow-rf-node">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <StepCard
        step={d.step}
        index={d.index}
        canEdit={d.canEdit}
        prompt={prompt}
        labels={edit?.labels ?? []}
        modelLabel={edit?.modelLabel ?? ((_p, m) => m)}
        promptMissing={promptMissing}
        needsPrompt={!d.step.promptId}
      />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
