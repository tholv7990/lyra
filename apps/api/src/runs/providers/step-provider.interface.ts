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

// A media asset a step produced (pre-persistence). The run service turns these
// into `Asset` documents and stamps their ids onto the step's `assetIds`.
export interface StepAssetOutput {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbUrl?: string;
  meta?: Record<string, unknown>;
}

export interface StepRunOutput {
  result: string;
  // Media outputs (image/video/audio). A text step omits this; a render step
  // returns one or more. Persisted as `Asset` docs and surfaced on the run.
  assets?: StepAssetOutput[];
  usage?: { tokens?: number; costUsd?: number };
  // true when this output was served from the step cache (no provider call).
  cached?: boolean;
}

// The single interface every step runs through. Implementations are registered
// per Provider in ProviderRegistry; the step.key -> Provider mapping lives in
// shared (STEP_PROVIDERS), so swapping a model is a one-line change.
export interface StepProvider {
  execute(ctx: StepRunContext): Promise<StepRunOutput>;
}
