import { type ModelOption } from '@lyra/shared';

// Providers list dozens of models (dated snapshots, legacy generations, every
// modality). The pickers want a short list of current flagship *chat* models —
// like the ChatGPT / Claude apps show a handful. These pure helpers curate the
// live listing down to the newest generation per family. New flagships appear
// automatically (no code change); old/dated variants drop off.

// A dated snapshot suffix, e.g. "...-2026-04-23".
const DATED = /-\d{4}-\d{2}-\d{2}$/;

// ----- Anthropic: the latest model per tier (opus / sonnet / haiku) -----
const CLAUDE_TIERS = ['opus', 'sonnet', 'haiku'] as const;

// First "major-minor" pair in the id, e.g. claude-opus-4-8 -> 408,
// claude-3-7-sonnet -> 307. Ignores any trailing date group.
function claudeVersion(id: string): number {
  const m = id.match(/-(\d+)-(\d+)/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
}

export function curateAnthropic(models: ModelOption[]): ModelOption[] {
  const best = new Map<string, { model: ModelOption; v: number }>();
  for (const model of models) {
    const tier = CLAUDE_TIERS.find((t) => model.id.includes(t));
    if (!tier) continue;
    const v = claudeVersion(model.id);
    const cur = best.get(tier);
    if (!cur || v > cur.v) best.set(tier, { model, v });
  }
  // Stable tier order: opus, sonnet, haiku.
  return CLAUDE_TIERS.map((t) => best.get(t)?.model).filter(
    (m): m is ModelOption => !!m,
  );
}

// ----- OpenAI: newest GPT family (+ pro/mini/nano) and newest reasoning model -----
// Drop non-chat / specialized variants so only general chat + reasoning remain.
const OPENAI_DROP =
  /(codex|instruct|chat-latest|search|preview|-16k|audio|image|tts|transcribe|realtime|whisper|embedding|moderation|dall-e)/i;

// gpt-5.5 -> 505, gpt-4o -> 400, gpt-4.1 -> 401. (Trailing variant ignored.)
function gptVersion(id: string): number | null {
  const m = id.match(/^gpt-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 100 + (m[2] ? Number(m[2]) : 0) : null;
}

// o4-mini -> 4, o3 -> 3, o1 -> 1.
function oVersion(id: string): number | null {
  const m = id.match(/^o(\d+)/);
  return m ? Number(m[1]) : null;
}

export function curateOpenAi(ids: string[]): ModelOption[] {
  const clean = ids.filter(
    (id) =>
      !DATED.test(id) &&
      !OPENAI_DROP.test(id) &&
      (/^gpt-\d/.test(id) || /^o\d/.test(id)),
  );

  // Keep only the newest GPT generation (all of its pro/mini/nano variants).
  const gpt = clean.filter((id) => gptVersion(id) !== null);
  const maxGpt = gpt.reduce((mx, id) => Math.max(mx, gptVersion(id)!), 0);
  const gptKeep = gpt.filter((id) => gptVersion(id) === maxGpt);

  // Keep only the newest reasoning (o-series) generation.
  const oser = clean.filter((id) => oVersion(id) !== null);
  const maxO = oser.reduce((mx, id) => Math.max(mx, oVersion(id)!), 0);
  const oKeep = oser.filter((id) => oVersion(id) === maxO);

  return [...new Set([...gptKeep, ...oKeep])]
    .sort()
    .map((id) => ({ id, label: id }));
}

// ----- DeepSeek: already a short list; just drop dated snapshots -----
export function curateDeepSeek(ids: string[]): ModelOption[] {
  return [...new Set(ids.filter((id) => !DATED.test(id)))]
    .sort()
    .map((id) => ({ id, label: id }));
}
