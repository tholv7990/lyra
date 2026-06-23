import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type CompetitionData } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const MARKET = ['healthy', 'dominated', 'commodity', 'emerging', 'underserved'] as const;
const SYS = `COMPETITION: From the provided evidence ONLY, list up to 8 competitors actually mentioned and classify the market. Reply ONLY JSON {"competitors":[{"name","price?","offer?","reviews?","strengths?"}],"marketType":"${MARKET.join('|')}"}. Never invent a competitor not present in the evidence.`;

function parseJson<T>(text: string, fb: T): T {
  const m = text.match(/\{[\s\S]*\}/); if (!m) return fb;
  try { return JSON.parse(m[0]) as T; } catch { return fb; }
}
function str(v: unknown): string | undefined { return typeof v === 'string' && v.trim() ? v.slice(0, 300) : undefined; }

@Injectable()
export class CompetitionAction implements ActionProvider {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
    private readonly keys: KeysService,
  ) {}

  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Competition needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);

    const evidence = ctx.ledger.evidence as EvidenceClaim[];
    const corpus = evidence.map((c) => `- (${c.sourceId}) ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 1024 };

    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }

    const parsed = parseJson<{ competitors?: unknown[]; marketType?: string }>(raw.text, {});
    const competitors = Array.isArray(parsed.competitors)
      ? parsed.competitors.slice(0, 8).map((c) => {
          const o = (c ?? {}) as Record<string, unknown>;
          return { name: String(o.name ?? '').slice(0, 200), price: str(o.price), offer: str(o.offer), reviews: str(o.reviews), strengths: str(o.strengths) };
        }).filter((c) => c.name)
      : [];
    const marketType = (MARKET as readonly string[]).includes(parsed.marketType ?? '') ? (parsed.marketType as CompetitionData['marketType']) : 'emerging';
    const competition: CompetitionData = { competitors, marketType };
    return { result: `# Competition\n${competitors.length} competitor(s) · market: ${marketType}`, data: { competition }, usage: raw.usage };
  }
}
