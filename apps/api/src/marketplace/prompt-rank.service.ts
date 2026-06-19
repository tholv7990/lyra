import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  defaultModel,
  Provider,
  type RankedMarketplacePrompt,
} from '@lyra/shared';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { KeysService } from '../keys/keys.service';
import { MarketplacePrompt } from './marketplace.schema';
import { toMarketplacePrompt } from './marketplace.views';

// How many catalog items the AI filter is allowed to consider, and how much of
// each prompt body to show it. Keeps the request compact + cheap.
const MAX_CATALOG = 400;
const PREVIEW_LEN = 200;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 12;

interface RankedItem {
  id: string;
  score: number;
  reason: string;
}

// AI filter for the marketplace: given a free-text need + the global catalog,
// ask Claude to rank the most relevant prompts. The model's output is fully
// re-validated here (unknown ids dropped, score clamped, reason coerced) and
// each surviving id is joined back to its full safe MarketplacePrompt shape.
@Injectable()
export class PromptRankService {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly keys: KeysService,
    @InjectModel(MarketplacePrompt.name)
    private readonly model: Model<MarketplacePrompt>,
  ) {}

  async rank(
    workspaceId: string,
    query: string,
    limit = DEFAULT_LIMIT,
  ): Promise<RankedMarketplacePrompt[]> {
    const need = query.trim();
    if (!need) return [];
    const cap = clampLimit(limit);

    const apiKey = await this.keys.getDecrypted(workspaceId, Provider.Anthropic);
    if (!apiKey) {
      throw new BadRequestException(
        'Add an Anthropic key in Settings to use the AI filter.',
      );
    }

    const docs = await this.model
      .find()
      .sort({ title: 1 })
      .limit(MAX_CATALOG)
      .exec();
    if (docs.length === 0) return [];
    const byId = new Map(docs.map((d) => [d._id.toString(), d]));

    const catalog = docs
      .map((d, i) => {
        const preview = (d.content ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, PREVIEW_LEN);
        return `${i + 1}. id: ${d._id.toString()} | title: ${d.title}${
          d.forDevs ? ' | for-devs' : ''
        }\n   ${preview}`;
      })
      .join('\n');

    const model = defaultModel(Provider.Anthropic);
    const completion = await this.anthropic.complete({
      apiKey,
      model,
      system: this.system(cap),
      prompt: `USER NEED:\n${need}\n\nCATALOG:\n${catalog}`,
      maxTokens: 1500,
    });

    const ranked = this.parse(completion.text, byId, cap);
    return ranked.map((r) => ({
      prompt: toMarketplacePrompt(byId.get(r.id)!),
      score: r.score,
      reason: r.reason,
    }));
  }

  private system(limit: number): string {
    return [
      'You are a prompt librarian. Given the user NEED and a CATALOG of community prompts, pick the most relevant prompts for the need.',
      '',
      'Rules:',
      `- Return at most ${limit} prompts, best match first.`,
      '- Only use ids that appear in the CATALOG. Never invent ids.',
      '- score is a 0-100 relevance number. reason is ONE short line.',
      '',
      'Respond with ONLY a JSON array (no prose, no code fence), exactly this shape:',
      '[{"id": "<id>", "score": <0-100>, "reason": "<one short line>"}]',
    ].join('\n');
  }

  // Defensive parse + repair, mirroring PipelineAiService: strip fences, parse,
  // drop unknown ids, clamp score, coerce reason, sort by score desc, cap.
  private parse(
    text: string,
    byId: Map<string, unknown>,
    limit: number,
  ): RankedItem[] {
    const json = extractJsonArray(text);
    if (!json) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const out: RankedItem[] = [];
    const seen = new Set<string>();
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      if (!id || !byId.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        score: clampScore(r.score),
        reason: typeof r.reason === 'string' ? r.reason.trim().slice(0, 200) : '',
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(limit));
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Pull a JSON array out of the model's text — a fenced block if present, else
// the outermost [...].
export function extractJsonArray(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inner = fence[1].trim();
    const s = inner.indexOf('[');
    const e = inner.lastIndexOf(']');
    if (s >= 0 && e > s) return inner.slice(s, e + 1);
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}
