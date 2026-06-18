import { BadRequestException, Injectable } from '@nestjs/common';
import {
  defaultModel,
  isModelAllowed,
  Provider,
  StepMode,
  type GeneratedPipeline,
  type GeneratedStep,
} from '@lyra/shared';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { PromptsService } from '../prompts/prompts.service';
import { KeysService } from '../keys/keys.service';

interface CatalogItem {
  id: string;
  title: string;
  tags: string[];
  provider?: string;
  model?: string;
  snippet: string;
}

const MAX_PROMPTS = 60;
const SNIPPET_LEN = 400;
const MAX_STEPS = 12;
const PROVIDERS = new Set<string>(Object.values(Provider));

// Designs a runnable pipeline from the workspace's prompt library + a goal,
// grounded to real prompt ids. The model's output is fully re-validated here —
// unknown prompt ids become "gap" steps, invalid provider·model is clamped to a
// valid catalog pair. Never persists; returns a draft for the builder.
@Injectable()
export class PipelineAiService {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly prompts: PromptsService,
    private readonly keys: KeysService,
  ) {}

  async generate(workspaceId: string, goal: string): Promise<GeneratedPipeline> {
    const apiKey = await this.keys.getDecrypted(workspaceId, Provider.Anthropic);
    if (!apiKey) {
      throw new BadRequestException(
        'Set your Anthropic key in Settings to build pipelines with AI.',
      );
    }

    const docs = await this.prompts.listPublic(workspaceId, MAX_PROMPTS);
    if (docs.length === 0) {
      throw new BadRequestException(
        'Your prompt library is empty — create some public prompts first.',
      );
    }
    const catalog: CatalogItem[] = docs.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      tags: p.tags ?? [],
      provider: p.provider,
      model: p.model,
      snippet: (p.content ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LEN),
    }));

    const model = defaultModel(Provider.Anthropic);
    const completion = await this.anthropic.complete({
      apiKey,
      model,
      system: this.designerPrompt(catalog),
      prompt: goal.trim(),
      maxTokens: 2000,
    });

    const parsed = this.parse(completion.text);
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const steps = this.repairSteps(parsed.steps.slice(0, MAX_STEPS), byId);

    return {
      name: clip(parsed.name, 120) || 'AI pipeline',
      description: clip(parsed.description, 2000),
      steps,
      origin: { source: 'ai', goal: goal.trim(), model },
    };
  }

  private designerPrompt(catalog: CatalogItem[]): string {
    const list = catalog
      .map((c) =>
        [
          `- id: ${c.id}`,
          `  title: ${c.title}`,
          c.tags.length ? `  tags: ${c.tags.join(', ')}` : '',
          c.provider ? `  default: ${c.provider}/${c.model ?? ''}` : '',
          `  snippet: ${c.snippet}`,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n');
    return [
      'You design Lyra pipelines: a short, ordered sequence of steps, where each step runs ONE library prompt on a model.',
      '',
      'You may ONLY use prompts from this catalog, referenced by their exact id. Never invent prompt ids or prompt text.',
      '',
      'CATALOG:',
      list,
      '',
      'Design a pipeline that accomplishes the user goal. Order steps logically (e.g. source/gather -> transform/brief -> generate/render). Keep it concise — only the steps the goal needs.',
      '',
      'For each step choose:',
      '- promptId: an id from the catalog. If NO catalog prompt fits a step the goal genuinely needs, set promptId to "" and describe the missing prompt in "suggestion".',
      `- provider + model: prefer the prompt's default; provider must be one of: ${[...PROVIDERS].join(', ')}.`,
      '- mode: "gate" if a human should approve before continuing, otherwise "auto".',
      '- name: a short step label.',
      '',
      'Respond with ONLY a JSON object (no prose, no code fence), exactly this shape:',
      '{"name": string, "description": string, "steps": [{"name": string, "promptId": string, "provider": string, "model": string, "mode": "auto"|"gate", "suggestion": string}]}',
    ].join('\n');
  }

  private parse(text: string): { name?: string; description?: string; steps: unknown[] } {
    const json = extractJson(text);
    if (!json) {
      throw new BadRequestException(
        'The AI returned an unexpected response. Try rephrasing your goal.',
      );
    }
    let obj: unknown;
    try {
      obj = JSON.parse(json);
    } catch {
      throw new BadRequestException('The AI returned malformed output. Please try again.');
    }
    const o = (obj ?? {}) as Record<string, unknown>;
    return {
      name: typeof o.name === 'string' ? o.name : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
      steps: Array.isArray(o.steps) ? o.steps : [],
    };
  }

  private repairSteps(raw: unknown[], byId: Map<string, CatalogItem>): GeneratedStep[] {
    const out: GeneratedStep[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const s = r as Record<string, unknown>;
      const matched = typeof s.promptId === 'string' ? byId.get(s.promptId) : undefined;

      const provider =
        toProvider(s.provider) ?? toProvider(matched?.provider) ?? Provider.Anthropic;
      let model = typeof s.model === 'string' ? s.model : '';
      if (!isModelAllowed(provider, model)) {
        model =
          matched?.model && isModelAllowed(provider, matched.model)
            ? matched.model
            : defaultModel(provider);
      }
      const name =
        clip(s.name, 80) || matched?.title || `Step ${out.length + 1}`;

      out.push({
        name,
        promptId: matched ? matched.id : '',
        provider,
        model,
        mode: s.mode === 'gate' ? StepMode.Gate : StepMode.Auto,
        suggestion: matched ? undefined : clip(s.suggestion, 200) || name,
      });
    }
    return out;
  }
}

function toProvider(v: unknown): Provider | undefined {
  return typeof v === 'string' && PROVIDERS.has(v) ? (v as Provider) : undefined;
}

function clip(v: unknown, n: number): string {
  return typeof v === 'string' ? v.trim().slice(0, n) : '';
}

// Pull a JSON object out of the model's text — a fenced block if present, else
// the outermost {...}.
function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}
