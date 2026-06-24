import type { Memory } from '../models';

export const MAX_RECALL_MEMORIES = 12;
export const MAX_RECALL_TOKENS = 1500;
export const estTokens = (text: string): number => Math.ceil(text.length / 4);

// Pure relevance: confidence × recency-decay (30-day half-life) × subject boost.
// recall ranks with this — never an LLM.
export function scoreMemory(m: Memory, ctx: { subjectId?: string; now: string }): number {
  const ageDays = Math.max(0, (new Date(ctx.now).getTime() - new Date(m.updatedAt).getTime()) / 86_400_000);
  const recencyDecay = 0.5 ** (ageDays / 30);
  const subjectBoost = m.subjectId && ctx.subjectId && m.subjectId === ctx.subjectId ? 2 : 1;
  return m.confidence * recencyDecay * subjectBoost;
}
