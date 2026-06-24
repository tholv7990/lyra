import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type CreativeConcept } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const SYS = 'CREATIVE POTENTIAL: From the evidence ONLY, propose up to 8 truthful ad concepts. Reply ONLY JSON {"concepts":[{"hook","angle"}]}. Do not invent unsupported claims.';
function parseJson<T>(text: string, fb: T): T { const m = text.match(/\{[\s\S]*\}/); if (!m) return fb; try { return JSON.parse(m[0]) as T; } catch { return fb; } }
const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 300) : '');

@Injectable()
export class CreativePotentialAction implements ActionProvider {
  constructor(private readonly anthropic: AnthropicClient, private readonly openai: OpenAiCompatClient, private readonly keys: KeysService) {}
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Creative-potential needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);
    const corpus = (ctx.ledger.evidence as EvidenceClaim[]).map((c) => `- ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 1024 };
    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }
    const p = parseJson<{ concepts?: unknown[] }>(raw.text, {});
    const creativeConcepts: CreativeConcept[] = Array.isArray(p.concepts)
      ? p.concepts.slice(0, 8).map((c) => { const o = (c ?? {}) as Record<string, unknown>; return { hook: str(o.hook), angle: str(o.angle) }; }).filter((c) => c.hook || c.angle)
      : [];
    return { result: `# Creative potential\n${creativeConcepts.length} concept(s)`, data: { creativeConcepts }, usage: raw.usage };
  }
}
