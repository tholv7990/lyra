import { Injectable } from '@nestjs/common';
import { AssetStorageService } from '../../assets/asset-storage.service';
import { ReplicateClient, type Prediction } from './replicate.client';
import type { StepProvider, StepRunContext, StepRunOutput } from './step-provider.interface';

const DEFAULT_VIDEO_MODEL = 'minimax/video-01';
const MAX_PROMPT = 4000;

// Per-model first-frame image input field for img2video. A model not listed here
// is text->video only (an input image is ignored, with a note). Confirm field names
// against the Replicate model schemas; add a slug here to make it animate images.
const IMG2VIDEO_IMAGE_FIELD: Record<string, string> = {
  'minimax/video-01': 'first_frame_image',
  'kwaivgi/kling-v1.6-standard': 'start_image',
};

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
    if (!this.storage.enabled) {
      throw new Error('Video rendering needs durable object storage (R2) — set the R2_* env to enable it.');
    }
    const prompt = (ctx.step.prompt || '').trim().slice(0, MAX_PROMPT);
    if (!prompt) throw new Error('No prompt to render a video from.');
    const model = ctx.step.model || DEFAULT_VIDEO_MODEL;
    // img2video: animate a prior step's image when the model supports an image input.
    const imageField = IMG2VIDEO_IMAGE_FIELD[model];
    const firstImage = ctx.inputImages?.[0]?.url;
    const useImage = !!imageField && !!firstImage;
    const input = useImage ? { prompt, [imageField]: firstImage } : { prompt };
    const imageIgnoredNote =
      ctx.inputImages?.length && !imageField
        ? ` (note: ${model} has no image-to-video input — pick an img2video-capable model to animate the input.)`
        : '';

    const created = await this.replicate.create(model, input, ctx.apiKey);
    return {
      result: `Submitted video generation with ${model}.${imageIgnoredNote}`,
      async: { jobId: created.id },
      usage: { tokens: 0 },
    };
  }

  // Re-host a finished Replicate prediction's mp4 to durable storage (R2). Used by
  // the video-job poller when the prediction succeeds. Replicate URLs expire.
  async finalize(pred: Prediction, model: string): Promise<StepRunOutput> {
    const out = pred.output;
    const outputUrl = Array.isArray(out) ? out[0] : out;
    if (typeof outputUrl !== 'string' || !outputUrl) throw new Error('Replicate returned no video output.');
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
