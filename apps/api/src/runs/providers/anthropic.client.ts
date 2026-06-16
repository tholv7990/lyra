import { Injectable } from '@nestjs/common';

// A file attachment sent to the model as a content block (base64).
export interface LlmAttachment {
  kind: 'image' | 'document';
  mediaType: string;
  dataBase64: string;
}

export interface LlmCompletionParams {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  attachments?: LlmAttachment[];
}

export interface LlmCompletion {
  text: string;
  usage?: { tokens?: number };
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Build the user message content: a string when there are no attachments, else
// a content-block array (text + image/document blocks).
function userContent(params: LlmCompletionParams): unknown {
  if (!params.attachments?.length) return params.prompt;
  const blocks: unknown[] = [{ type: 'text', text: params.prompt }];
  for (const a of params.attachments) {
    blocks.push({
      type: a.kind,
      source: { type: 'base64', media_type: a.mediaType, data: a.dataBase64 },
    });
  }
  return blocks;
}

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
        messages: [{ role: 'user', content: userContent(params) }],
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

  // Streaming variant: invokes onDelta for each text chunk and resolves with the
  // full text + token usage. Used by the prompt-testing playground (SSE).
  async stream(
    params: LlmCompletionParams,
    onDelta: (text: string) => void,
  ): Promise<LlmCompletion> {
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
        messages: [{ role: 'user', content: userContent(params) }],
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as AnthropicResponse;
      throw new Error(body.error?.message ?? `Anthropic request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let evt: {
          type?: string;
          delta?: { type?: string; text?: string };
          message?: { usage?: { input_tokens?: number } };
          usage?: { output_tokens?: number };
        };
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          const chunk = evt.delta.text ?? '';
          text += chunk;
          onDelta(chunk);
        } else if (evt.type === 'message_start') {
          inputTokens = evt.message?.usage?.input_tokens ?? 0;
        } else if (evt.type === 'message_delta') {
          outputTokens = evt.usage?.output_tokens ?? outputTokens;
        }
      }
    }

    return { text: text.trim(), usage: { tokens: inputTokens + outputTokens } };
  }
}
