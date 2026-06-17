import { createContext, useContext } from 'react';
import type { Prompt, Provider } from '@lyra/shared';

export interface FlowCallbacks {
  busy: boolean;
  // run mode
  onRunStep?: (index: number) => void;
  onApprove?: (index: number) => void;
  onSavePrompt?: (index: number, prompt: string) => void;
  // edit mode
  onEdit?: (index: number) => void;
  onToggleMode?: (index: number) => void;
  onMove?: (index: number, dir: -1 | 1) => void;
  onRemove?: (index: number) => void;
  onInsert?: (index: number) => void;
  onViewPrompt?: (promptId: string) => void;
}

const Ctx = createContext<FlowCallbacks>({ busy: false });
export const FlowCallbacksProvider = Ctx.Provider;
export const useFlowCallbacks = () => useContext(Ctx);

// Builder-wide data the edit-mode step nodes need to render a full StepCard
// (the bound prompt, the label palette, the model labeller). Constant across
// nodes, so it rides a context instead of being baked into each node's data —
// which keeps buildGraph pure and per-node data minimal.
export interface FlowEditData {
  prompts: Prompt[];
  labels: ReadonlyArray<{ name: string; color: string }>;
  modelLabel: (p: Provider, m: string) => string;
}

const EditCtx = createContext<FlowEditData | null>(null);
export const FlowEditDataProvider = EditCtx.Provider;
export const useFlowEditData = () => useContext(EditCtx);
