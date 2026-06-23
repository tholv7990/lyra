import type { Step, StepKey, EvidenceClaim, SourceRow } from '@lyra/shared';

// A prior step's output, fed as context to the current step.
export interface PriorStepResult {
  key?: StepKey;
  title: string;
  result: string;
}

// An image fed as an input to an image step (for edit/compose). Resolved by the
// run engine from {input}/{step:Name} → prior steps' image assets (base64).
export interface StepInputImage {
  url: string;
  mime: string;
  b64: string;
}

// Everything a provider needs to execute one step. The decrypted provider key
// is resolved by the service (per-workspace, BYOK) and passed in — providers
// never read keys themselves.
export interface StepRunContext {
  step: Step;
  apiKey: string;
  priorResults: PriorStepResult[];
  inputImages?: StepInputImage[]; // present only for image steps that reference prior images
  workspaceId: string;
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
  evidence?: EvidenceClaim[];
  sources?: SourceRow[];
}

// The single interface every step runs through. Implementations are registered
// per Provider in ProviderRegistry; the step.key -> Provider mapping lives in
// shared (STEP_PROVIDERS), so swapping a model is a one-line change.
export interface StepProvider {
  execute(ctx: StepRunContext): Promise<StepRunOutput>;
}
