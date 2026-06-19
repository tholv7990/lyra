import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useFlowCallbacks } from './flowCallbacks';

// A bezier edge with an n8n-style "+" button at its midpoint that inserts a new
// step at this gap. The insert index rides on the edge's data (set by buildEditGraph).
export function InsertEdge(props: EdgeProps) {
  const { t } = useTranslation();
  const [path, labelX, labelY] = getBezierPath(props);
  const cb = useFlowCallbacks();
  const insertIndex = (props.data as { insertIndex?: number } | undefined)?.insertIndex;
  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} />
      {cb.onInsert && insertIndex != null && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="flow-add nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            title={t('common.addStep')}
            onClick={() => cb.onInsert!(insertIndex)}
          >
            +
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
