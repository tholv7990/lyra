import type { Memory } from '../models';

export const MAX_RECALL_MEMORIES = 12;
export const MAX_RECALL_TOKENS = 1500;
export const estTokens = (text: string): number => Math.ceil(text.length / 4);

// Generous default token budget for the run engine's auto-appended prior-step context.
// Bounds runaway growth on long pipelines without starving a step of needed context.
export const DEFAULT_RUN_CONTEXT_TOKENS = 8000;

// Budgeted "recall, don't append-all" for the run engine: keep the most RECENT priors
// (newest→oldest) whose cumulative estimated tokens fit `budgetTokens`, returned in their
// ORIGINAL order. Pure (no LLM). Always keeps at least the most-recent prior when any
// exist, so a single oversized prior still flows rather than dropping all context.
export function selectPriorContext<T extends { result: string }>(priors: T[], budgetTokens: number): T[] {
  const kept = new Set<number>();
  let tokens = 0;
  for (let i = priors.length - 1; i >= 0; i--) {
    const t = estTokens(priors[i].result);
    if (tokens + t > budgetTokens && kept.size > 0) break;
    kept.add(i);
    tokens += t;
  }
  return priors.filter((_, i) => kept.has(i));
}

// Pure relevance: confidence × recency-decay (30-day half-life) × subject boost.
// recall ranks with this — never an LLM.
export function scoreMemory(m: Memory, ctx: { subjectId?: string; now: string }): number {
  const ageDays = Math.max(0, (new Date(ctx.now).getTime() - new Date(m.updatedAt).getTime()) / 86_400_000);
  const recencyDecay = 0.5 ** (ageDays / 30);
  const subjectBoost = m.subjectId && ctx.subjectId && m.subjectId === ctx.subjectId ? 2 : 1;
  return m.confidence * recencyDecay * subjectBoost;
}
