import { Injectable } from '@nestjs/common';
import { Provider } from '@lyra/shared';
import type { LlmCompletion, LlmAttachment } from './anthropic.client';

// Base URLs for the OpenAI-compatible chat-completions API.
export const OPENAI_COMPAT_BASE: Partial<Record<Provider, string>> = {
  [Provider.OpenAI]: 'https://api.openai.com/v1',
  [Provider.DeepSeek]: 'https://api.deepseek.com/v1',
};

export interface OpenAiParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  attachments?: LlmAttachment[];
}

interface ChatResponse {
  choices?: { message?: { content?: string }; delta?: { content?: string } }[];
  usage?: { total_tokens?: number };
  error?: { message?: string };
}

// Thin client for OpenAI & DeepSeek (both speak the OpenAI chat API). Native
// fetch, injectable so tests can stub it (hermetic e2e). BYOK key per call.
@Injectable()
export class OpenAiCompatClient {
  // The user message: a plain string, or (when images are attached) the
  // OpenAI multimodal parts array — text plus image_url data-URIs. Non-image
  // attachments (e.g. PDFs) aren't supported by chat completions, so they're
  // dropped here.
  private userContent(p: OpenAiParams): unknown {
    const images = (p.attachments ?? []).filter((a) => a.kind === 'image');
    if (!images.length) return p.prompt;
    return [
      { type: 'text', text: p.prompt },
      ...images.map((a) => ({
        type: 'image_url',
        image_url: { url: `data:${a.mediaType};base64,${a.dataBase64}` },
      })),
    ];
  }

  private body(p: OpenAiParams, stream: boolean) {
    return JSON.stringify({
      model: p.model,
      max_tokens: p.maxTokens ?? 2048,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: this.userContent(p) },
      ],
    });
  }

  private headers(p: OpenAiParams) {
    return { 'content-type': 'application/json', authorization: `Bearer ${p.apiKey}` };
  }

  // List available model ids (GET /models).
  async listModels(baseUrl: string, apiKey: string): Promise<string[]> {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: { id?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(body.error?.message ?? `Request failed (${res.status})`);
    }
    return (body.data ?? []).map((m) => m.id).filter((x): x is string => !!x);
  }

  async complete(p: OpenAiParams): Promise<LlmCompletion> {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(p),
      body: this.body(p, false),
    });
    const body = (await res.json().catch(() => ({}))) as ChatResponse;
    if (!res.ok) {
      throw new Error(body.error?.message ?? `Request failed (${res.status})`);
    }
    return {
      text: (body.choices?.[0]?.message?.content ?? '').trim(),
      usage: { tokens: body.usage?.total_tokens ?? 0 },
    };
  }

  async stream(p: OpenAiParams, onDelta: (text: string) => void): Promise<LlmCompletion> {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(p),
      body: this.body(p, true),
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as ChatResponse;
      throw new Error(body.error?.message ?? `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let tokens = 0;

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
        let evt: ChatResponse;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        const chunk = evt.choices?.[0]?.delta?.content;
        if (chunk) {
          text += chunk;
          onDelta(chunk);
        }
        if (evt.usage?.total_tokens) tokens = evt.usage.total_tokens;
      }
    }

    return { text: text.trim(), usage: { tokens } };
  }
}
