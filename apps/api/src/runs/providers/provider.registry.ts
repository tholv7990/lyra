import { Injectable } from '@nestjs/common';
import { Provider } from '@lyra/shared';
import { AnthropicStepProvider } from './anthropic.provider';
import { OpenAiCompatStepProvider } from './openai-compat.provider';
import { CrawlStepProvider } from './crawl.provider';
import { ImageStepProvider } from './image.provider';
import { GeminiImageStepProvider } from './gemini-image.provider';
import { MockStepProvider } from './mock.provider';
import type { StepProvider } from './step-provider.interface';

// Provider -> StepProvider implementation. Combined with the step.key -> Provider
// map in shared (STEP_PROVIDERS), this is the single dispatch point: swapping a
// model for a step is a one-line change here or in shared.
//
// Phase 4 wires Anthropic (the brain steps). The source/render providers stay
// mock until phases 5 and 6.
@Injectable()
export class ProviderRegistry {
  private readonly impls: Record<Provider, StepProvider>;

  constructor(
    anthropic: AnthropicStepProvider,
    openai: OpenAiCompatStepProvider,
    crawl: CrawlStepProvider,
    image: ImageStepProvider,
    geminiImage: GeminiImageStepProvider,
    mock: MockStepProvider,
  ) {
    this.impls = {
      [Provider.Anthropic]: anthropic,
      [Provider.OpenAI]: openai,
      [Provider.DeepSeek]: openai,
      [Provider.Crawl]: crawl, // real: fetch a URL → images + text (no key)
      [Provider.Image]: image, // real: OpenAI gpt-image-1 (reuses the OpenAI key)
      [Provider.Google]: geminiImage, // real: Gemini gemini-2.5-flash-image (Google key)
      [Provider.Video]: mock, // video stays mock until a real render provider is wired
    };
  }

  get(provider: Provider): StepProvider {
    return this.impls[provider];
  }
}
