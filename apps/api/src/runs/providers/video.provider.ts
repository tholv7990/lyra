import { Injectable } from '@nestjs/common';
import { AssetStorageService } from '../../assets/asset-storage.service';
import { ReplicateClient } from './replicate.client';
import type { StepProvider, StepRunContext, StepRunOutput } from './step-provider.interface';

const DEFAULT_VIDEO_MODEL = 'minimax/video-01';
const MAX_PROMPT = 4000;

// Real video generation via Replicate (BYO token in the workspace 'video' key slot).
// Creates a prediction, polls until done, then re-hosts the output mp4 to R2 (Replicate
// output URLs expire). The run engine's synchronous await holds the request open while
// it polls — no queue.
@Injectable()
export class VideoStepProvider implements StepProvider {
  constructor(
    private readonly replicate: ReplicateClient,
    private readonly storage: AssetStorageService,
  ) {}

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    if (!ctx.apiKey) {
      throw new Error('Video generation needs the workspace Replicate key — set it in Settings.');
    }
    const prompt = (ctx.step.prompt || '').trim().slice(0, MAX_PROMPT);
    if (!prompt) throw new Error('No prompt to render a video from.');
    const model = ctx.step.model || DEFAULT_VIDEO_MODEL;

    const outputUrl = await this.replicate.run(model, { prompt }, ctx.apiKey, {});

    // Re-host to R2 — Replicate delivery URLs expire, so the asset must be durable.
    const res = await fetch(outputUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Failed to fetch the rendered video (HTTP ${res.status}).`);
    const buf = Buffer.from(await res.arrayBuffer());
    const key = `generated/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp4`;
    const url = await this.storage.store(buf, 'video/mp4', key);

    return {
      result: `Generated 1 video with ${model}.`,
      assets: [{ type: 'video', url, meta: { role: 'generated', model } }],
      usage: { tokens: 0 },
    };
  }
}
