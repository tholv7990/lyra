import { BadRequestException, Injectable } from '@nestjs/common';
import { defaultModel, Provider, TEXT_FALLBACK_ORDER } from '@lyra/shared';
import type { StepProvider, StepRunContext, StepRunOutput } from './step-provider.interface';
import { TavilyClient } from './tavily.client';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { ConnectorCredentialsService } from '../../connectors/connector-credentials.service';
import { KeysService } from '../../keys/keys.service';
import { runResearch, type ResearchCaps } from './research.agent';
import { safeFetch } from '../../common/safe-fetch';

const CAPS: ResearchCaps = { maxRounds: 2, maxSearchesPerRound: 3, maxSources: 12, maxLlmCalls: 6 };
const RESULTS_PER_SEARCH = 5;

// Grounded agentic web-research step. Resolves the workspace's Tavily key (search)
// + the first available text LLM key (Anthropic → OpenAI → DeepSeek, per
// TEXT_FALLBACK_ORDER) for plan/extract/reflect. Registered in ProviderRegistry
// as Provider.Research.
@Injectable()
export class ResearchStepProvider implements StepProvider {
  constructor(
    private readonly tavily: TavilyClient,
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
    private readonly creds: ConnectorCredentialsService,
    private readonly keys: KeysService,
  ) {}

  async execute(ctx: StepRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const tavilyKey = await this.creds.getDecrypted(ws, 'tavily');
    if (!tavilyKey) throw new BadRequestException('Connect a Tavily search key first — add it in Connections.');

    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) {
      throw new BadRequestException('Research needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    }
    const aiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);
    const client = aiProvider === Provider.Anthropic ? this.anthropic : this.openai;

    const result = await runResearch(ctx.step.prompt, {
      search: (q) => this.tavily.search(q, { apiKey: tavilyKey, maxResults: RESULTS_PER_SEARCH }),
      llm: async (system, prompt) => {
        if (aiProvider === Provider.Anthropic) {
          return (await (client as AnthropicClient).complete({ apiKey: aiKey, model, system, prompt, maxTokens: 2048 })).text;
        }
        const baseUrl = compatBaseUrl(aiProvider) ?? '';
        return (await (client as OpenAiCompatClient).complete({ baseUrl, provider: aiProvider, apiKey: aiKey, model, system, prompt, maxTokens: 2048 })).text;
      },
      checkAlive: async (url) => { try { return (await safeFetch(url)).ok; } catch { return false; } },
      caps: CAPS,
    });

    const live = result.sources.filter((s) => s.alive).length;
    const summary = [
      `# Research: ${ctx.step.prompt}`,
      '',
      `${result.claims.length} grounded claim(s) across ${result.sources.length} source(s) (${live} live), ${result.rounds} round(s).`,
      ...result.claims.map((c) => `- [${c.kind}] ${c.statement} (→ ${c.sourceId})`),
    ].join('\n');

    return { result: summary, evidence: result.claims, sources: result.sources, usage: { tokens: 0 } };
  }
}
