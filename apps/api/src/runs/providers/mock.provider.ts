import { Injectable } from '@nestjs/common';
import { Provider, StepKey } from '@lyra/shared';
import type {
  StepAssetOutput,
  StepProvider,
  StepRunContext,
  StepRunOutput,
} from './step-provider.interface';

// Deterministic mock output — no provider call, no spend. Used for providers
// not yet wired (openai, deepseek, image, video); they become real in their
// own phases (5 and 6). Image/Video steps also emit a placeholder asset so the
// run's asset path is exercised end-to-end without a real render.
@Injectable()
export class MockStepProvider implements StepProvider {
  execute(ctx: StepRunContext): Promise<StepRunOutput> {
    return Promise.resolve({
      result: mockResult(ctx.step.key),
      assets: mockAssets(ctx.step.provider as Provider | undefined),
      usage: { tokens: 0, costUsd: 0 },
    });
  }
}

function mockAssets(provider?: Provider): StepAssetOutput[] | undefined {
  if (provider === Provider.Image) {
    return [{ type: 'image', url: 'https://placehold.co/600x600?text=mock+image', meta: { mock: true } }];
  }
  if (provider === Provider.Video) {
    return [{ type: 'video', url: 'https://placehold.co/600x600?text=mock+video', meta: { mock: true } }];
  }
  return undefined;
}

function mockResult(key?: StepKey): string {
  switch (key) {
    case StepKey.Find:
      return '[mock] 9 competitor sources found, each with URL, hook, format, and why it performs.';
    case StepKey.Crawl:
      return '[mock] Crawled sources → structured JSON: ad copy, hooks, specs, price points, visual patterns.';
    case StepKey.Brief:
      return '[mock] Brand brief: color story, product details, voice/tone, the Quiet Hero arc. (gate — review & approve)';
    case StepKey.Insight:
      return '[mock] Competitor insight: winning angles, repeated visual patterns, the gap to own, tropes to avoid.';
    case StepKey.Prompts:
      return '[mock] 9 image prompts + 3 UGC scripts generated. (gate — review & approve)';
    case StepKey.Images:
      return '[mock] Rendered 9 stills (hero, grip detail, lifestyle ×3, studio ×2, before/after, packaging).';
    case StepKey.Video:
      return '[mock] Produced 3 avatar UGC ads + 1 cinematic b-roll cut with brand-matched voiceover.';
    case StepKey.QA:
      return '[mock] Assembled batch: logo + grade + captions applied, brand fit & product accuracy checked. (gate — approve to ship)';
    default:
      return '[mock] step complete.';
  }
}
