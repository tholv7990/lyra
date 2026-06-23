import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type ReviewMining } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const SYS = 'REVIEW MINING: From the evidence ONLY, mine buyer reviews. Reply ONLY JSON {"complaints":["..."],"desiredFeatures":["..."],"objections":["..."]}. Empty arrays if unknown. Do not invent.';
function parseJson<T>(text: string, fb: T): T { const m = text.match(/\{[\s\S]*\}/); if (!m) return fb; try { return JSON.parse(m[0]) as T; } catch { return fb; } }
const arr = (v: unknown, n: number): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.slice(0, 200)).slice(0, n) : [];

@Injectable()
export class ReviewMiningAction implements ActionProvider {
  constructor(private readonly anthropic: AnthropicClient, private readonly openai: OpenAiCompatClient, private readonly keys: KeysService) {}
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Review-mining needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);
    const corpus = (ctx.ledger.evidence as EvidenceClaim[]).map((c) => `- ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 1024 };
    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }
    const p = parseJson<{ complaints?: unknown; desiredFeatures?: unknown; objections?: unknown }>(raw.text, {});
    const reviewMining: ReviewMining = { complaints: arr(p.complaints, 15), desiredFeatures: arr(p.desiredFeatures, 15), objections: arr(p.objections, 15) };
    return { result: `# Review mining\n${reviewMining.complaints.length} complaint(s)`, data: { reviewMining }, usage: raw.usage };
  }
}
