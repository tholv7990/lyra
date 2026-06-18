import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  defaultModel,
  isModelAllowed,
  Provider,
  StepMode,
  type AiChatResponse,
  type AiChatTurn,
  type GeneratedPipeline,
  type GeneratedStep,
  type PipelineStepInput,
} from '@lyra/shared';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { PromptsService } from '../prompts/prompts.service';
import { KeysService } from '../keys/keys.service';
import { Run } from '../runs/run.schema';
import { PipelinesService } from './pipelines.service';

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
const MAX_EXAMPLES = 3;
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
    @InjectModel(Run.name) private readonly runModel: Model<Run>,
    private readonly pipelines: PipelinesService,
  ) {}

  async generate(
    workspaceId: string,
    goal: string,
    current?: PipelineStepInput[],
  ): Promise<GeneratedPipeline> {
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
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const examples = await this.topExamples(workspaceId, byId);

    const model = defaultModel(Provider.Anthropic);
    const completion = await this.anthropic.complete({
      apiKey,
      model,
      system: this.designerPrompt(catalog, current, examples),
      prompt: goal.trim(),
      maxTokens: 2000,
    });

    const parsed = this.parse(completion.text);
    const steps = this.repairSteps(parsed.steps.slice(0, MAX_STEPS), byId);

    return {
      name: clip(parsed.name, 120) || 'AI pipeline',
      description: clip(parsed.description, 2000),
      steps,
      origin: { source: 'ai', goal: goal.trim(), model },
    };
  }

  // Conversational design (Phase 2): one turn. The AI replies in words and, when
  // it has a concrete proposal, attaches a draft (grounded + validated here).
  async chat(
    workspaceId: string,
    messages: AiChatTurn[],
    current?: PipelineStepInput[],
  ): Promise<AiChatResponse> {
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
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const examples = await this.topExamples(workspaceId, byId);

    const model = defaultModel(Provider.Anthropic);
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const last = messages[messages.length - 1];
    const completion = await this.anthropic.complete({
      apiKey,
      model,
      system: this.chatDesignerPrompt(catalog, current, examples),
      prompt: last?.content?.trim() || '...',
      history,
      maxTokens: 2000,
    });

    const { message, pipeline } = this.chatParse(completion.text);
    let draft: GeneratedPipeline | undefined;
    if (pipeline && pipeline.steps.length) {
      const steps = this.repairSteps(pipeline.steps.slice(0, MAX_STEPS), byId);
      if (steps.length) {
        const goal = messages.find((m) => m.role === 'user')?.content?.trim().slice(0, 4000) ?? '';
        draft = {
          name: clip(pipeline.name, 120) || 'AI pipeline',
          description: clip(pipeline.description, 2000),
          steps,
          origin: { source: 'ai', goal, model },
        };
      }
    }
    return { reply: message || 'Okay.', draft };
  }

  // Top-rated pipelines in the workspace by net thumbs (up - down), filtered to
  // net > 0, tiebroken by up-count then run-count. Read-only — drives few-shot.
  private async topRatedPipelineIds(workspaceId: string, limit = MAX_EXAMPLES): Promise<string[]> {
    const rows = await this.runModel.aggregate<{ _id: unknown }>([
      {
        $match: {
          workspaceId,
          'rating.value': { $in: ['up', 'down'] },
          pipelineId: { $type: 'string' },
        },
      },
      {
        $group: {
          _id: '$pipelineId',
          up: { $sum: { $cond: [{ $eq: ['$rating.value', 'up'] }, 1, 0] } },
          down: { $sum: { $cond: [{ $eq: ['$rating.value', 'down'] }, 1, 0] } },
          runs: { $sum: 1 },
        },
      },
      { $addFields: { net: { $subtract: ['$up', '$down'] } } },
      { $match: { net: { $gt: 0 } } },
      { $sort: { net: -1, up: -1, runs: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => String(r._id));
  }

  // A compact few-shot block from the workspace's top-rated pipelines, or '' when
  // none qualify. Prompt titles resolve from the catalog already loaded; a prompt
  // not in the public catalog shows "(prompt unavailable)" but keeps the step shape.
  private async topExamples(workspaceId: string, byId: Map<string, CatalogItem>): Promise<string> {
    const ids = await this.topRatedPipelineIds(workspaceId);
    const blocks: string[] = [];
    for (const id of ids) {
      const p = await this.pipelines.findActiveById(id);
      if (!p || !p.steps?.length) continue;
      const goal = clip(
        p.origin?.goal || `${p.name}${p.description ? ` — ${p.description}` : ''}`,
        300,
      );
      const lines = p.steps.map((s, i) => {
        const title = !s.promptId ? '(gap)' : byId.get(s.promptId)?.title ?? '(prompt unavailable)';
        return `  ${i + 1}. ${s.name} [${s.provider}/${s.model}] ${s.mode} — prompt "${title}" (id: ${s.promptId || 'none'})`;
      });
      blocks.push([`Example ${blocks.length + 1} — Goal: ${goal}`, ...lines].join('\n'));
    }
    return blocks.join('\n\n');
  }

  private designerPrompt(catalog: CatalogItem[], current?: PipelineStepInput[], examples = ''): string {
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

    // Revise mode: when the builder sends the current steps, frame the goal as an
    // edit instruction and show the AI the existing pipeline to rewrite.
    const byTitle = new Map(catalog.map((c) => [c.id, c.title]));
    const task =
      current && current.length
        ? [
            'CURRENT PIPELINE (the user wants to revise this):',
            current
              .map((s, i) => {
                const title = s.promptId
                  ? byTitle.get(s.promptId) ?? `prompt ${s.promptId}`
                  : '(no prompt — gap)';
                return `${i + 1}. ${s.name} [${s.provider}/${s.model}] ${s.mode} — uses: ${title}`;
              })
              .join('\n'),
            '',
            "The user's message is an INSTRUCTION to revise this pipeline. Return the COMPLETE revised pipeline: keep steps that still fit; add, modify, remove, or reorder as needed to satisfy the instruction.",
          ]
        : [
            'Design a pipeline that accomplishes the user goal. Order steps logically (e.g. source/gather -> transform/brief -> generate/render). Keep it concise — only the steps the goal needs.',
          ];

    return [
      'You design Lyra pipelines: a short, ordered sequence of steps, where each step runs ONE library prompt on a model.',
      '',
      'You may ONLY use prompts from this catalog, referenced by their exact id. Never invent prompt ids or prompt text.',
      '',
      'CATALOG:',
      list,
      '',
      ...(examples
        ? [
            'EXAMPLES OF WELL-RATED PIPELINES IN THIS WORKSPACE (inspiration for structure and prompt selection; you may reuse their prompt ids when they fit the goal):',
            examples,
            '',
          ]
        : []),
      ...task,
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

  private chatDesignerPrompt(catalog: CatalogItem[], current?: PipelineStepInput[], examples = ''): string {
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
    const byTitle = new Map(catalog.map((c) => [c.id, c.title]));
    const currentText =
      current && current.length
        ? [
            '',
            'CURRENT PIPELINE (what exists now — revise it as the conversation goes):',
            current
              .map((s, i) => {
                const title = s.promptId
                  ? byTitle.get(s.promptId) ?? `prompt ${s.promptId}`
                  : '(no prompt — gap)';
                return `${i + 1}. ${s.name} [${s.provider}/${s.model}] ${s.mode} — uses: ${title}`;
              })
              .join('\n'),
          ]
        : [];
    return [
      "You are Lyra's pipeline design assistant. Through a short conversation you help the user design or refine a runnable pipeline from THEIR prompt library.",
      '',
      'You may ONLY use prompts from this catalog, referenced by their exact id. Never invent prompt ids or prompt text.',
      '',
      'CATALOG:',
      list,
      ...currentText,
      '',
      ...(examples
        ? [
            'EXAMPLES OF WELL-RATED PIPELINES IN THIS WORKSPACE (inspiration for structure and prompt selection; you may reuse their prompt ids when they fit the goal):',
            examples,
            '',
          ]
        : []),
      'Behaviour:',
      '- If the goal is clear enough, propose a pipeline right away. Ask a SHORT clarifying question only when you genuinely cannot proceed.',
      '- When you propose or revise, keep it concise and grounded. Set promptId to "" (a gap) with a "suggestion" when no catalog prompt fits a needed step.',
      `- provider must be one of: ${[...PROVIDERS].join(', ')}; prefer each prompt's default model; mode is "gate" (human approves) or "auto".`,
      '',
      'Respond with ONLY a JSON object (no prose outside it), exactly:',
      '{"message": string, "pipeline": {"name": string, "description": string, "steps": [{"name": string, "promptId": string, "provider": string, "model": string, "mode": "auto"|"gate", "suggestion": string}]} | null}',
      '- "message": your conversational reply to show the user (a question, or a one-line summary of what you built/changed).',
      '- "pipeline": include the FULL current proposal whenever you have one (initial or revised). Use null only when purely asking a question with nothing to propose yet.',
    ].join('\n');
  }

  private chatParse(text: string): {
    message: string;
    pipeline?: { name?: string; description?: string; steps: unknown[] };
  } {
    const json = extractJson(text);
    if (!json) return { message: text.trim() };
    let obj: unknown;
    try {
      obj = JSON.parse(json);
    } catch {
      return { message: text.trim() };
    }
    const o = (obj ?? {}) as Record<string, unknown>;
    const message = typeof o.message === 'string' ? o.message : text.trim();
    const p = o.pipeline;
    if (p && typeof p === 'object') {
      const pp = p as Record<string, unknown>;
      const steps = Array.isArray(pp.steps) ? pp.steps : [];
      if (steps.length) {
        return {
          message,
          pipeline: {
            name: typeof pp.name === 'string' ? pp.name : undefined,
            description: typeof pp.description === 'string' ? pp.description : undefined,
            steps,
          },
        };
      }
    }
    return { message };
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
