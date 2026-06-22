import { Injectable } from '@nestjs/common';
import type { StepInputImage } from './step-provider.interface';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiImageParams {
  apiKey: string;
  model: string;
  prompt: string;
  inputImages: StepInputImage[];
}

// Thin raw-fetch client for Gemini image generation/editing (gemini-2.5-flash-image).
// Mirrors anthropic.client.ts/openai-compat.client.ts — no SDK. The BYO Google key
// rides in the x-goog-api-key header (never a URL/log).
@Injectable()
export class GeminiClient {
  async generateImage(p: GeminiImageParams): Promise<{ b64: string; mime: string }> {
    const parts: unknown[] = [{ text: p.prompt }];
    for (const img of p.inputImages) {
      parts.push({ inlineData: { mimeType: img.mime || 'image/png', data: img.b64 } });
    }
    const res = await fetch(`${BASE}/${encodeURIComponent(p.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`gemini ${p.model} -> ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] } }[];
    };
    const partsOut = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of partsOut) {
      const inline = part.inlineData ?? part.inline_data;
      const b64 = inline?.data;
      if (b64) return { b64, mime: (part.inlineData?.mimeType ?? part.inline_data?.mime_type) || 'image/png' };
    }
    throw new Error('Gemini returned no image.');
  }
}
