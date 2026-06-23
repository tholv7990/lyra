import { BadRequestException, Injectable } from '@nestjs/common';
import { TEXT_FALLBACK_ORDER, defaultModel, Provider, type EvidenceClaim, type CustomerJob } from '@lyra/shared';
import { AnthropicClient } from './anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from './openai-compat.client';
import { KeysService } from '../../keys/keys.service';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

const SYS = 'CUSTOMER JOB: From the evidence ONLY, infer the buyer\'s job-to-be-done. Reply ONLY JSON {"customer","job","problem","alternative","trigger"}. Each a short string; "" if unknown. Do not invent.';
function parseJson<T>(text: string, fb: T): T { const m = text.match(/\{[\s\S]*\}/); if (!m) return fb; try { return JSON.parse(m[0]) as T; } catch { return fb; } }
const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 300) : '');

@Injectable()
export class CustomerJobAction implements ActionProvider {
  constructor(private readonly anthropic: AnthropicClient, private readonly openai: OpenAiCompatClient, private readonly keys: KeysService) {}
  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    const ws = ctx.workspaceId;
    const present = new Set((await this.keys.list(ws)).map((k) => k.provider));
    const aiProvider = TEXT_FALLBACK_ORDER.find((p) => present.has(p));
    if (!aiProvider) throw new BadRequestException('Customer-job needs an AI provider key (Anthropic/OpenAI/DeepSeek) — add one in Settings.');
    const apiKey = (await this.keys.getDecrypted(ws, aiProvider)) ?? '';
    const model = defaultModel(aiProvider);
    const corpus = (ctx.ledger.evidence as EvidenceClaim[]).map((c) => `- ${c.statement}`).join('\n') || '(no evidence)';
    const params = { apiKey, model, system: SYS, prompt: `Evidence:\n${corpus}`, maxTokens: 512 };
    let raw: { text: string; usage?: { tokens?: number } };
    if (aiProvider === Provider.Anthropic) raw = await this.anthropic.complete(params);
    else { const baseUrl = compatBaseUrl(aiProvider) ?? ''; raw = await this.openai.complete({ ...params, baseUrl, provider: aiProvider }); }
    const p = parseJson<Partial<Record<keyof CustomerJob, unknown>>>(raw.text, {});
    const customerJob: CustomerJob = { customer: str(p.customer), job: str(p.job), problem: str(p.problem), alternative: str(p.alternative), trigger: str(p.trigger) };
    return { result: `# Customer job\n${customerJob.job || '(none)'}`, data: { customerJob }, usage: raw.usage };
  }
}
