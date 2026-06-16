import { Injectable } from '@nestjs/common';

export interface LlmCompletionParams {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface LlmCompletion {
  text: string;
  usage?: { tokens?: number };
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

// Thin wrapper over the Anthropic Messages API using native fetch (no SDK
// dependency). Injectable so tests can override it with a stub — keeping e2e
// hermetic (no network, no spend). The api key is per call (per-workspace BYOK).
@Injectable()
export class AnthropicClient {
  async complete(params: LlmCompletionParams): Promise<LlmCompletion> {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 2048,
        system: params.system,
        messages: [{ role: 'user', content: params.prompt }],
      }),
    });

    const body = (await res.json().catch(() => ({}))) as AnthropicResponse;
    if (!res.ok) {
      const msg = body.error?.message ?? `Anthropic request failed (${res.status})`;
      throw new Error(msg);
    }

    const text = (body.content ?? [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('\n')
      .trim();
    const tokens =
      (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0);
    return { text, usage: { tokens } };
  }
}
