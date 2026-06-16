import { Injectable } from '@nestjs/common';
import { defaultModel, isModelAllowed, Provider, STEP_DEFS } from '@lyra/shared';
import { OpenAiCompatClient, OPENAI_COMPAT_BASE } from './openai-compat.client';
import type {
  StepProvider,
  StepRunContext,
  StepRunOutput,
} from './step-provider.interface';

const SYSTEM_PROMPT = [
  'You are Lyra, an AI creative-strategy assistant running one step of a brand',
  'creative pipeline. Follow the step instructions exactly and return only the',
  'requested deliverable in Markdown. Be concrete and on-brand.',
].join(' ');

// Runs steps on OpenAI or DeepSeek (both OpenAI-compatible). The same instance
// handles both providers; the base URL + model are derived from the step.
@Injectable()
export class OpenAiCompatStepProvider implements StepProvider {
  constructor(private readonly client: OpenAiCompatClient) {}

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    const provider = ctx.step.provider ?? Provider.OpenAI;
    const baseUrl = OPENAI_COMPAT_BASE[provider];
    if (!baseUrl) throw new Error(`No endpoint configured for ${provider}`);

    // Composable steps carry a real model id; fixed steps carry a display label.
    const model = isModelAllowed(provider, ctx.step.model)
      ? ctx.step.model
      : defaultModel(provider);

    const title = STEP_DEFS[ctx.step.index]?.title ?? ctx.step.name ?? ctx.step.key;
    const parts = [`# Step: ${title}`, '', ctx.step.prompt.trim()];
    if (ctx.priorResults.length) {
      parts.push('', '---', '## Context from earlier steps');
      for (const prior of ctx.priorResults) {
        parts.push('', `### ${prior.title}`, prior.result.trim());
      }
    }

    const out = await this.client.complete({
      baseUrl,
      apiKey: ctx.apiKey,
      model,
      system: SYSTEM_PROMPT,
      prompt: parts.join('\n'),
    });
    if (!out.text) throw new Error(`No response from ${provider}`);
    return { result: out.text, usage: out.usage };
  }
}
