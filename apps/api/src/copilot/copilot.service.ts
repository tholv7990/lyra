import { BadRequestException, Injectable } from '@nestjs/common';
import {
  defaultModel,
  Provider,
  Role,
  type AiChatTurn,
  type CopilotResponse,
} from '@lyra/shared';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { KeysService } from '../keys/keys.service';
import { PromptsService } from '../prompts/prompts.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { ProjectsService } from '../projects/projects.service';
import { RunsService } from '../runs/runs.service';

const SYSTEM = [
  'You are Lyra Copilot, a helpful assistant inside the Lyra app.',
  'Help the user understand and work with THEIR workspace: the prompt library, pipelines, projects, and runs.',
  '',
  'ALWAYS use the tools to look up real data before answering questions about their workspace — never guess names, ids, step contents, or run results. If something is not found, say so plainly.',
  'You can READ but not change anything. Be concise and concrete; refer to things by their real names. When you cite a run result, summarise it rather than dumping the whole thing.',
].join('\n');

const TOOLS = [
  {
    name: 'search_prompts',
    description:
      'Search the workspace public prompt library by keyword. Returns matching prompts with id, title, tags and a content snippet. Empty query returns recent prompts.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'keywords to match in title/tags/content' } },
    },
  },
  {
    name: 'list_pipelines',
    description: 'List every pipeline in the workspace: id, name, step count, and step names.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pipeline',
    description: "Get one pipeline's full steps (name, provider/model, gate/auto, and bound prompt title) by name or id.",
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, id: { type: 'string' } },
    },
  },
  {
    name: 'list_projects',
    description: 'List the projects the user can see: id, name, status, description.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project_runs',
    description: 'List recent runs for a project (by name or id), each with its pipeline, status, date, and per-step status.',
    input_schema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'project name or id' } },
      required: ['project'],
    },
  },
  {
    name: 'get_run_result',
    description: "Get a run's steps and their outputs/results by run id (the model, status, and a snippet of each step's result).",
    input_schema: {
      type: 'object',
      properties: { run_id: { type: 'string' } },
      required: ['run_id'],
    },
  },
];

// Read-only copilot: Claude with tools over the user's workspace. Grounds its
// answers in real prompts/pipelines/projects/runs; never mutates anything.
@Injectable()
export class CopilotService {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly keys: KeysService,
    private readonly prompts: PromptsService,
    private readonly pipelines: PipelinesService,
    private readonly projects: ProjectsService,
    private readonly runs: RunsService,
  ) {}

  async chat(workspaceId: string, userId: string, messages: AiChatTurn[]): Promise<CopilotResponse> {
    const apiKey = await this.keys.getDecrypted(workspaceId, Provider.Anthropic);
    if (!apiKey) {
      throw new BadRequestException('Set your Anthropic key in Settings to use Lyra Copilot.');
    }
    const out = await this.anthropic.runWithTools({
      apiKey,
      model: defaultModel(Provider.Anthropic),
      system: SYSTEM,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: TOOLS,
      runTool: (name, input) =>
        this.execTool(workspaceId, userId, name, (input ?? {}) as Record<string, unknown>),
      maxTokens: 1500,
      maxRounds: 6,
    });
    return { reply: out.text || 'Okay.', tools: [...new Set(out.toolCalls)] };
  }

  private execTool(
    workspaceId: string,
    userId: string,
    name: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    switch (name) {
      case 'search_prompts':
        return this.searchPrompts(workspaceId, s(input.query));
      case 'list_pipelines':
        return this.listPipelines(workspaceId);
      case 'get_pipeline':
        return this.getPipeline(workspaceId, userId, s(input.name) || s(input.id));
      case 'list_projects':
        return this.listProjects(workspaceId, userId);
      case 'get_project_runs':
        return this.getProjectRuns(workspaceId, userId, s(input.project));
      case 'get_run_result':
        return this.getRunResult(workspaceId, s(input.run_id) || s((input as { runId?: string }).runId));
      default:
        return Promise.resolve(`Unknown tool: ${name}`);
    }
  }

  private snip(text: string | undefined, n: number): string {
    return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  }

  private async searchPrompts(workspaceId: string, query: string): Promise<string> {
    const docs = await this.prompts.listPublic(workspaceId, 200);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (p: { title: string; tags?: string[]; content?: string }) => {
      if (!terms.length) return true;
      const hay = `${p.title} ${(p.tags ?? []).join(' ')} ${p.content ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    };
    const out = docs
      .filter(match)
      .slice(0, 20)
      .map((p) => ({
        id: p._id.toString(),
        title: p.title,
        tags: p.tags ?? [],
        snippet: this.snip(p.content, 200),
      }));
    return JSON.stringify({ count: out.length, prompts: out });
  }

  private async listPipelines(workspaceId: string): Promise<string> {
    const docs = await this.pipelines.listForWorkspace(workspaceId);
    return JSON.stringify({
      count: docs.length,
      pipelines: docs.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        steps: p.steps.length,
        stepNames: p.steps.map((s) => s.name),
      })),
    });
  }

  private async getPipeline(workspaceId: string, userId: string, ref: string): Promise<string> {
    const docs = await this.pipelines.listForWorkspace(workspaceId);
    const lref = ref.toLowerCase();
    const p =
      docs.find((d) => d._id.toString() === ref) ||
      docs.find((d) => d.name.toLowerCase() === lref) ||
      docs.find((d) => d.name.toLowerCase().includes(lref));
    if (!p) return JSON.stringify({ error: `No pipeline matches "${ref}".` });
    const prompts = await this.prompts.listVisible(workspaceId, userId);
    const titleById = new Map(prompts.map((q) => [q._id.toString(), q.title]));
    return JSON.stringify({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      steps: p.steps.map((s) => ({
        name: s.name,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        prompt: s.promptId ? titleById.get(s.promptId) ?? '(prompt not found)' : '(no prompt — gap)',
      })),
    });
  }

  private async listProjects(workspaceId: string, userId: string): Promise<string> {
    const docs = await this.projects.listForMember(workspaceId, { userId, role: Role.Member });
    return JSON.stringify({
      count: docs.length,
      projects: docs.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        status: p.status,
        description: this.snip(p.description, 160),
      })),
    });
  }

  private async resolveProject(workspaceId: string, userId: string, ref: string) {
    const docs = await this.projects.listForMember(workspaceId, { userId, role: Role.Member });
    const lref = ref.toLowerCase();
    return (
      docs.find((d) => d._id.toString() === ref) ||
      docs.find((d) => d.name.toLowerCase() === lref) ||
      docs.find((d) => d.name.toLowerCase().includes(lref))
    );
  }

  private async getProjectRuns(workspaceId: string, userId: string, ref: string): Promise<string> {
    const project = await this.resolveProject(workspaceId, userId, ref);
    if (!project) return JSON.stringify({ error: `No project matches "${ref}".` });
    const runs = await this.runs.listForProject(project._id.toString());
    return JSON.stringify({
      project: project.name,
      count: runs.length,
      runs: runs.slice(0, 12).map((r) => ({
        id: r._id.toString(),
        pipeline: r.pipelineName,
        status: r.status,
        createdAt: r.createdAt,
        steps: (r.steps ?? []).map((s) => ({ name: s.name, status: s.status })),
      })),
    });
  }

  private async getRunResult(workspaceId: string, runId: string): Promise<string> {
    const run = await this.runs.findById(runId);
    if (!run || run.workspaceId !== workspaceId) {
      return JSON.stringify({ error: `Run "${runId}" not found in this workspace.` });
    }
    return JSON.stringify({
      id: run._id.toString(),
      pipeline: run.pipelineName,
      status: run.status,
      steps: (run.steps ?? []).map((s) => ({
        name: s.name,
        provider: s.provider,
        model: s.model,
        status: s.status,
        result: this.snip(s.result, 600),
        error: s.error,
      })),
    });
  }
}
