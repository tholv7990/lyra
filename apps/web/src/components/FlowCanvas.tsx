import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls,
  Panel, useNodesState, useEdgesState, useReactFlow, useNodesInitialized, type Node, type Edge,
} from '@xyflow/react';
import { CapNode } from './flow/CapNode';
import { RunStepNode } from './flow/RunStepNode';
import { StepNode } from './flow/StepNode';
import { InsertEdge } from './flow/InsertEdge';
import {
  FlowCallbacksProvider,
  FlowEditDataProvider,
  type FlowCallbacks,
  type FlowEditData,
} from './flow/flowCallbacks';

// MODULE-LEVEL constants — React Flow requires stable nodeTypes/edgeTypes references.
const nodeTypes = { cap: CapNode, runStep: RunStepNode, step: StepNode };
const edgeTypes = { insert: InsertEdge };

export interface FlowCanvasProps {
  graph: { nodes: Node[]; edges: Edge[] };
  callbacks: FlowCallbacks;
  editData?: FlowEditData;
}

function Canvas({ graph, callbacks, editData }: FlowCanvasProps) {
  const { t } = useTranslation();
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const fittedRef = useRef(false);

  // Re-derive when the source graph changes (status, reorder, insert/remove).
  // Preserve any user-dragged position by node id; new nodes follow layout.
  useEffect(() => {
    setNodes((prev) => {
      const pos = new Map(prev.map((n) => [n.id, n.position]));
      return graph.nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }));
    });
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  // Fit the flow once, AFTER the async-loaded nodes are actually measured. The
  // `fitView` prop only fires on mount — before the graph populates — so it
  // leaves the flow stranded at the bottom of an empty canvas. `useNodesInitialized`
  // is the reliable "nodes measured" signal. Guarded so later status updates
  // (during a run) or a user pan/zoom don't re-yank the view.
  useEffect(() => {
    if (nodesInitialized && !fittedRef.current && nodes.length > 0) {
      fittedRef.current = true;
      fitView({ duration: 250, padding: 0.2 });
    }
  }, [nodesInitialized, nodes.length, fitView]);

  const tidy = () => {
    setNodes((prev) => prev.map((n) => {
      const src = graph.nodes.find((g) => g.id === n.id);
      return src ? { ...n, position: src.position } : n;
    }));
    requestAnimationFrame(() => fitView({ duration: 250 }));
  };

  return (
    <FlowCallbacksProvider value={callbacks}>
      <FlowEditDataProvider value={editData ?? null}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesConnectable={false}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
          <Controls showInteractive={false} />
          <Panel position="top-right">
            <button type="button" className="btn-ghost flow-tidy" onClick={tidy}>{t('common.tidy')}</button>
          </Panel>
        </ReactFlow>
      </FlowEditDataProvider>
    </FlowCallbacksProvider>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <div className="flow-canvas">
      <ReactFlowProvider>
        <Canvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
