import { Injectable } from '@nestjs/common';

// A file attachment sent to the model as a content block (base64).
export interface LlmAttachment {
  kind: 'image' | 'document';
  mediaType: string;
  dataBase64: string;
}

// Prior conversation turns (text only) for multi-turn chat. The current turn is
// passed via `prompt`/`attachments`; history carries the earlier exchanges.
export interface LlmTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionParams {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  history?: LlmTurn[];
  maxTokens?: number;
  attachments?: LlmAttachment[];
  signal?: AbortSignal;
}

export interface LlmCompletion {
  text: string;
  usage?: { tokens?: number };
  aborted?: boolean;
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

// Mark the system prompt as a cacheable prefix (Anthropic prompt caching).
// When the same template is reused across runs/steps, cache hits cost ~0.1x of
// input. Below the model's minimum cacheable size it simply isn't cached — no
// error, no write premium. Verify via the response's cache_read_input_tokens.
function systemBlocks(system: string) {
  return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
}

// Prior turns + the current user message. History is text-only (attachments
// apply to the current turn); the current turn may carry image/document blocks.
function buildMessages(params: LlmCompletionParams) {
  const history = (params.history ?? []).map((t) => ({ role: t.role, content: t.content }));
  return [...history, { role: 'user', content: userContent(params) }];
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  error?: { message?: string };
}

// Thin wrapper over the Anthropic Messages API using native fetch (no SDK
// dependency). Injectable so tests can override it with a stub — keeping e2e
// hermetic (no network, no spend). The api key is per call (per-workspace BYOK).
@Injectable()
export class AnthropicClient {
  // List available models (GET /v1/models) -> {id, label}.
  async listModels(apiKey: string): Promise<{ id: string; label: string }[]> {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: { id?: string; display_name?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(body.error?.message ?? `Request failed (${res.status})`);
    }
    return (body.data ?? [])
      .filter((m) => !!m.id)
      .map((m) => ({ id: m.id as string, label: m.display_name ?? (m.id as string) }));
  }

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
        ...(params.system ? { system: systemBlocks(params.system) } : {}),
        messages: buildMessages(params),
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

  // Agentic tool loop (non-streaming): give the model tools, run a round of
  // tool_use → execute (via runTool) → tool_result → repeat until it answers in
  // text (or a safety cap). Used by the read-only Lyra Copilot.
  async runWithTools(params: {
    apiKey: string;
    model: string;
    system: string;
    // Conversation as Anthropic messages — content is a string or a block array.
    messages: { role: 'user' | 'assistant'; content: unknown }[];
    tools: { name: string; description: string; input_schema: Record<string, unknown> }[];
    runTool: (name: string, input: unknown) => Promise<string>;
    maxTokens?: number;
    maxRounds?: number;
  }): Promise<{ text: string; toolCalls: string[]; usage: { tokens: number } }> {
    const messages = [...params.messages];
    const toolCalls: string[] = [];
    let tokens = 0;

    for (let round = 0; round < (params.maxRounds ?? 6); round++) {
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
          system: systemBlocks(params.system),
          tools: params.tools,
          messages,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(body.error?.message ?? `Anthropic request failed (${res.status})`);
      }
      tokens += (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0);
      const content = body.content ?? [];

      if (body.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content });
        const results: unknown[] = [];
        for (const block of content) {
          if (block.type !== 'tool_use') continue;
          toolCalls.push(block.name ?? 'tool');
          let result: string;
          try {
            result = await params.runTool(block.name ?? '', block.input);
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : 'tool failed'}`;
          }
          results.push({ type: 'tool_result', tool_use_id: block.id, content: result.slice(0, 12000) });
        }
        messages.push({ role: 'user', content: results });
        continue;
      }

      const text = content
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { text, toolCalls, usage: { tokens } };
    }
    return {
      text: 'I looked into that but hit my tool-use limit — try asking a bit more specifically.',
      toolCalls,
      usage: { tokens },
    };
  }

  // Streaming variant: invokes onDelta for each text chunk and resolves with the
  // full text + token usage. Used by the prompt-testing playground (SSE).
  async stream(
    params: LlmCompletionParams,
    onDelta: (text: string) => void,
  ): Promise<LlmCompletion> {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: params.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 2048,
        ...(params.system ? { system: systemBlocks(params.system) } : {}),
        messages: buildMessages(params),
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

    try {
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
    } catch (err) {
      // Client stopped the run -> abort the provider call, keep the partial text.
      if ((err as Error)?.name !== 'AbortError') throw err;
      return { text: text.trim(), usage: { tokens: inputTokens + outputTokens }, aborted: true };
    }

    return { text: text.trim(), usage: { tokens: inputTokens + outputTokens } };
  }
}
