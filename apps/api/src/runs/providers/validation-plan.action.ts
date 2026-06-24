import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type ValidationPlan, type UnitEcon } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const SYS = 'VALIDATION PLAN: From the evidence ONLY, write a lean test plan. Reply ONLY JSON {"offer","landingPageHypothesis","creatives":["..."],"channel","decisionRule"}. creatives: up to 5. decisionRule: pass/pause/kill/scale thresholds. Do not invent unsupported claims.';
function parseJson<T>(text: string, fb: T): T { const m = text.match(/\{[\s\S]*\}/); if (!m) return fb; try { return JSON.parse(m[0]) as T; } catch { return fb; } }
const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 500) : '');
const arr = (v: unknown, n: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.slice(0, 300)).slice(0, n) : []);

@Injectable()
export class ValidationPlanAction implements ActionProvider {
  constructor(private readonly anthropic: AnthropicClient, private readonly openai: OpenAiCompatClient, private readonly keys: KeysService) {}
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Validation-plan needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);
    const corpus = (ctx.ledger.evidence as EvidenceClaim[]).map((c) => `- (${c.sourceId}) ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 700 };
    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }
    const p = parseJson<{ offer?: unknown; landingPageHypothesis?: unknown; creatives?: unknown; channel?: unknown; decisionRule?: unknown }>(raw.text, {});
    const maxCac = (ctx.ledger.data as { unitEcon?: UnitEcon }).unitEcon?.maxCac;
    const validationPlan: ValidationPlan = {
      offer: str(p.offer),
      landingPageHypothesis: str(p.landingPageHypothesis),
      creatives: arr(p.creatives, 5),
      channel: str(p.channel),
      decisionRule: str(p.decisionRule),
      ...(typeof maxCac === 'number' && Number.isFinite(maxCac) && maxCac > 0 ? { testBudget: Math.round(maxCac * 25) } : {}),
    };
    return { result: `# Validation plan\n${validationPlan.offer || '(none)'}`, data: { validationPlan }, usage: raw.usage };
  }
}
