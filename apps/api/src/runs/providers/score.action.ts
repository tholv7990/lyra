import { BadRequestException, Injectable } from '@nestjs/common';
import { WEIGHTS, TEXT_FALLBACK_ORDER, defaultModel, Provider, type SubScores, type EvidenceClaim } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const DIMS = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[];
const SYS = `SCORE: Rate the product opportunity on each dimension 0-5 (integer), grounded ONLY in the provided evidence — no outside knowledge. Dimensions: ${DIMS.join(', ')}. Reply ONLY JSON {"subScores":{${DIMS.map((d) => `"${d}":n`).join(',')}}}.`;

function parseJson<T>(text: string, fb: T): T {
  const m = text.match(/\{[\s\S]*\}/); if (!m) return fb;
  try { return JSON.parse(m[0]) as T; } catch { return fb; }
}

@Injectable()
export class ScoreAction implements ActionProvider {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
    private readonly keys: KeysService,
  ) {}

  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Scoring needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);

    const evidence = ctx.ledger.evidence as EvidenceClaim[];
    const corpus = evidence.map((c) => `- (${c.sourceId}) [${c.kind}] ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 512 };

    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) {
      raw = await this.anthropic.complete(params);
    } else {
      const baseUrl = compatBaseUrl(aiProvider) ?? '';
      raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider });
    }

    const parsed = parseJson<{ subScores?: Record<string, unknown> }>(raw.text, {});
    const subScores = Object.fromEntries(
      DIMS.map((d) => [d, Math.max(0, Math.min(5, Math.round(Number(parsed.subScores?.[d]) || 0)))]),
    ) as SubScores;
    const total = DIMS.reduce((n, d) => n + subScores[d], 0);
    return { result: `# Score\nsub-scores set (${total}/${DIMS.length * 5} raw) from ${evidence.length} claim(s).`, data: { subScores }, usage: raw.usage };
  }
}
