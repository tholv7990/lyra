import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type SupplyChainInfo } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const SYS = 'SUPPLY CHAIN: From the evidence ONLY, summarize supply. Reply ONLY JSON {"suppliers":["..."],"moq","leadTime","certs":["..."],"notes":["..."]}. Put any UNVERIFIED fact in notes as an assumption. Do not invent.';
function parseJson<T>(text: string, fb: T): T { const m = text.match(/\{[\s\S]*\}/); if (!m) return fb; try { return JSON.parse(m[0]) as T; } catch { return fb; } }
const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 300) : '');
const arr = (v: unknown, n: number): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.slice(0, 200)).slice(0, n) : [];

@Injectable()
export class SupplyChainAction implements ActionProvider {
  constructor(private readonly anthropic: AnthropicClient, private readonly openai: OpenAiCompatClient, private readonly keys: KeysService) {}
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Supply-chain needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);
    const corpus = (ctx.ledger.evidence as EvidenceClaim[]).map((c) => `- ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 1024 };
    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }
    const p = parseJson<{ suppliers?: unknown; moq?: unknown; leadTime?: unknown; certs?: unknown; notes?: unknown }>(raw.text, {});
    const supplyChain: SupplyChainInfo = {
      suppliers: arr(p.suppliers, 10),
      certs: arr(p.certs, 10),
      notes: arr(p.notes, 10),
      ...(str(p.moq) ? { moq: str(p.moq) } : {}),
      ...(str(p.leadTime) ? { leadTime: str(p.leadTime) } : {}),
    };
    return { result: `# Supply chain\n${supplyChain.suppliers.length} supplier(s)`, data: { supplyChain }, usage: raw.usage };
  }
}
