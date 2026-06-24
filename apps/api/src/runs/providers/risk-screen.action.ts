import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type RiskFlags } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const SYS = `RISK SCREEN: Conservatively flag ONLY clear, high-severity, unresolved risks for selling this product, based on the evidence. Reply ONLY JSON {"unresolvedSafety":bool,"materialIpRisk":bool,"misleadingClaimsRequired":bool,"riskNotes":["..."]}. Set a flag true ONLY when clear: materialIpRisk = branded character/logo/likely-patent; unresolvedSafety = clearly unsafe/regulated category (ingestible, electrical, child); misleadingClaimsRequired = cannot sell without an unsubstantiated/medical claim. Default every flag false. Add one short riskNote per true flag. Do not speculate.`;

function parseJson<T>(text: string, fb: T): T {
  const m = text.match(/\{[\s\S]*\}/); if (!m) return fb;
  try { return JSON.parse(m[0]) as T; } catch { return fb; }
}

@Injectable()
export class RiskScreenAction implements ActionProvider {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
    private readonly keys: KeysService,
  ) {}

  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Risk screen needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);

    const evidence = ctx.ledger.evidence as EvidenceClaim[];
    const corpus = evidence.map((c) => `- (${c.sourceId}) ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 512 };

    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }

    const p = parseJson<{ unresolvedSafety?: unknown; materialIpRisk?: unknown; misleadingClaimsRequired?: unknown; riskNotes?: unknown[] } | null>(raw.text, null);
    const riskFlags: RiskFlags = {
      unresolvedSafety: p?.unresolvedSafety === true,
      materialIpRisk: p?.materialIpRisk === true,
      misleadingClaimsRequired: p?.misleadingClaimsRequired === true,
    };
    if (!p) {
      // Couldn't parse the model's response. Do NOT emit "0 risks" — that reads as screened-clean.
      // Surface a verify marker instead; flags stay false so an LLM hiccup never auto-REJECTs a product.
      const riskNotes = ['Could not screen automatically — the risk model returned an unreadable response. Verify safety, IP, and claims manually before testing.'];
      return { result: `# Risk screen\n⚠ Could not screen automatically — verify risks manually.`, data: { riskFlags, riskNotes }, usage: raw.usage };
    }
    const riskNotes = Array.isArray(p.riskNotes) ? p.riskNotes.filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, 300)).slice(0, 10) : [];
    const flagged = Object.values(riskFlags).filter(Boolean).length;
    return { result: `# Risk screen\n${flagged} risk flag(s) raised.${riskNotes.length ? '\n' + riskNotes.map((n) => `- ${n}`).join('\n') : ''}`, data: { riskFlags, riskNotes }, usage: raw.usage };
  }
}
