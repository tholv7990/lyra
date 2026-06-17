import { Handle, Position, type NodeProps } from '@xyflow/react';

export function CapNode({ data }: NodeProps) {
  const kind = (data as { kind: 'start' | 'end' }).kind;
  return (
    <div className={`flow-cap ${kind === 'end' ? 'end' : ''}`}>
      {kind === 'start' ? '● Start' : '◉ End'}
      {kind === 'start'
        ? <Handle type="source" position={Position.Right} isConnectable={false} />
        : <Handle type="target" position={Position.Left} isConnectable={false} />}
    </div>
  );
}
