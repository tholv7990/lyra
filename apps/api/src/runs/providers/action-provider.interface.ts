import type { ActionStep, ProjectBrandKit, ActionType, Step } from '@lyra/shared';
import type { PriorStepResult, StepRunOutput } from './step-provider.interface';
import type { RunLedger } from '../run-ledger';

export interface ActionRunContext {
  action: ActionStep;
  step: Step; // resolved prompt holds the chained input (e.g. image URL from {input})
  projectId?: string;
  productId?: string; // a research run targets a product; SaveProduct enriches it
  workspaceId: string;
  priorResults: PriorStepResult[];
  brandKit?: ProjectBrandKit; // resolved by the service for brand actions
  ledger: RunLedger;
}

export interface ActionProvider {
  execute(ctx: ActionRunContext): Promise<StepRunOutput>;
}

export type { ActionType };
