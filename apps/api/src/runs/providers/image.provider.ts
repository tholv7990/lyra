import { Injectable } from '@nestjs/common';
import { AssetStorageService } from '../../assets/asset-storage.service';
import type { StepProvider, StepRunContext, StepRunOutput } from './step-provider.interface';

const IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const MAX_PROMPT = 4000;

// Real image generation via OpenAI (gpt-image-1 / DALL·E 3). Authenticates with
// the workspace's OpenAI key (resolved by the run service via keyProviderFor —
// image steps reuse the OpenAI key). The image comes back base64 and is stored
// inline as a data: URL on the asset, so it displays and downloads with no
// object storage. (Cloudflare R2 is the proper later path for large media.)
@Injectable()
export class ImageStepProvider implements StepProvider {
  constructor(private readonly storage: AssetStorageService) {}

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    if (!ctx.apiKey) {
      throw new Error('Image generation needs the workspace OpenAI key — set it in Settings.');
    }
    const prompt = (ctx.step.prompt || '').trim().slice(0, MAX_PROMPT);
    if (!prompt) {
      throw new Error('No prompt to render an image from.');
    }

    const model = ctx.step.model || 'gpt-image-1';
    const body: Record<string, unknown> = { model, prompt, n: 1, size: '1024x1024' };
    // DALL·E returns a URL by default — ask for base64 so we can store it inline.
    // gpt-image-1 always returns base64 (and rejects response_format).
    if (model.startsWith('dall-e')) body.response_format = 'b64_json';

    const res = await fetch(IMAGES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(data.error?.message || `Image generation failed (HTTP ${res.status}).`);
    }
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('Image generation returned no image.');
    }

    // Store durably (R2 when configured) — returns an R2 URL or an inline data: URL.
    const key = `generated/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
    const url = await this.storage.store(Buffer.from(b64, 'base64'), 'image/png', key);

    return {
      result: `Generated 1 image with ${model}.`,
      assets: [{ type: 'image', url, meta: { role: 'generated', model } }],
      usage: { tokens: 0 },
    };
  }
}
