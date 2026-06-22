import { Injectable } from '@nestjs/common';
import { AssetStorageService } from '../../assets/asset-storage.service';
import { GeminiClient } from './gemini.client';
import type { StepProvider, StepRunContext, StepRunOutput } from './step-provider.interface';

const MAX_PROMPT = 4000;

// Real image generation/editing via Google Gemini (gemini-2.5-flash-image). Uses
// the workspace's Google key (Provider.Google). Input images (from {input}/{step:Name}
// → prior image assets) are sent as inlineData parts for native edit/compose.
@Injectable()
export class GeminiImageStepProvider implements StepProvider {
  constructor(
    private readonly gemini: GeminiClient,
    private readonly storage: AssetStorageService,
  ) {}

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    if (!ctx.apiKey) {
      throw new Error('Image generation needs the workspace Google key — set it in Settings.');
    }
    const prompt = (ctx.step.prompt || '').trim().slice(0, MAX_PROMPT);
    if (!prompt) throw new Error('No prompt to render an image from.');

    const model = ctx.step.model || 'gemini-2.5-flash-image';
    const inputImages = ctx.inputImages ?? [];
    const { b64, mime } = await this.gemini.generateImage({ apiKey: ctx.apiKey, model, prompt, inputImages });

    const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
    const key = `generated/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const url = await this.storage.store(Buffer.from(b64, 'base64'), mime, key);

    return {
      result: `Generated 1 image with ${model}${inputImages.length ? ` (edited ${inputImages.length} input${inputImages.length > 1 ? 's' : ''})` : ''}.`,
      assets: [{ type: 'image', url, meta: { role: 'generated', model, edited: inputImages.length > 0 } }],
      usage: { tokens: 0 },
    };
  }
}
