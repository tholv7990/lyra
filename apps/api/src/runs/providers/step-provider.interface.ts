import type { Step, StepKey } from '@lyra/shared';

// A prior step's output, fed as context to the current step.
export interface PriorStepResult {
  key?: StepKey;
  title: string;
  result: string;
}

// Everything a provider needs to execute one step. The decrypted provider key
// is resolved by the service (per-workspace, BYOK) and passed in — providers
// never read keys themselves.
export interface StepRunContext {
  step: Step;
  apiKey: string;
  priorResults: PriorStepResult[];
}

export interface StepRunOutput {
  result: string;
  usage?: { tokens?: number; costUsd?: number };
}

// The single interface every step runs through. Implementations are registered
// per Provider in ProviderRegistry; the step.key -> Provider mapping lives in
// shared (STEP_PROVIDERS), so swapping a model is a one-line change.
export interface StepProvider {
  execute(ctx: StepRunContext): Promise<StepRunOutput>;
}
