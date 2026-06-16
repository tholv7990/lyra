import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { looksLikeModelId, STEP_DEFS } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import type {
  StepProvider,
  StepRunContext,
  StepRunOutput,
} from './step-provider.interface';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = [
  'You are Lyra, an AI creative-strategy assistant running one step of an',
  '8-step brand creative pipeline (find → crawl → brief → insight → prompts →',
  'images → video → assemble/QA). Follow the step instructions exactly and',
  'return only the requested deliverable, well-structured in Markdown. Be',
  'concrete and on-brand; do not pad with preamble or restate the instructions.',
].join(' ');

// Runs the "brain" steps (brief, insight, prompts) on Claude. The step's
// (possibly user-edited) prompt is the instruction; completed prior steps are
// supplied as context so later steps build on earlier ones.
@Injectable()
export class AnthropicStepProvider implements StepProvider {
  constructor(
    private readonly client: AnthropicClient,
    private readonly config: ConfigService,
  ) {}

  // Prefer the step's chosen model (composable pipeline) when it carries a real
  // model id; otherwise fall back to the configured default (fixed runs carry a
  // display label like "Claude" in step.model). We no longer gate on the static
  // catalog so freshly refreshed model ids pass straight through.
  private resolveModel(stepModel: string): string {
    if (looksLikeModelId(stepModel)) return stepModel;
    return this.config.get<string>('ANTHROPIC_MODEL') ?? DEFAULT_MODEL;
  }

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    const title = STEP_DEFS[ctx.step.index]?.title ?? ctx.step.name ?? ctx.step.key;

    const parts = [`# Step: ${title}`, '', ctx.step.prompt.trim()];
    if (ctx.priorResults.length) {
      parts.push('', '---', '## Context from earlier steps');
      for (const prior of ctx.priorResults) {
        parts.push('', `### ${prior.title}`, prior.result.trim());
      }
    }

    const completion = await this.client.complete({
      apiKey: ctx.apiKey,
      model: this.resolveModel(ctx.step.model),
      system: SYSTEM_PROMPT,
      prompt: parts.join('\n'),
    });

    if (!completion.text) {
      throw new Error('Claude returned an empty response');
    }
    return { result: completion.text, usage: completion.usage };
  }
}
