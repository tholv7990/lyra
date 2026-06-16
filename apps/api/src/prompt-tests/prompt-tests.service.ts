import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  isModelAllowed,
  Provider,
  PromptStatus,
  type PromptTest as PromptTestModel,
} from '@lyra/shared';
import { PromptTest } from './prompt-test.schema';
import type { PromptTestDocument } from './prompt-test.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { KeysService } from '../keys/keys.service';
import { PromptsService } from '../prompts/prompts.service';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { toPromptTest, promptTestActorIds } from './prompt-test.views';

const SYSTEM_PROMPT =
  "You are Lyra's prompt-testing assistant. Respond directly and helpfully to " +
  'the prompt below, returning a well-structured answer in Markdown.';

interface RunOutput {
  result: string;
  usage?: { tokens?: number; costUsd?: number };
}

@Injectable()
export class PromptTestsService extends BaseRepository<PromptTest> {
  constructor(
    @InjectModel(PromptTest.name) model: Model<PromptTest>,
    private readonly users: UsersService,
    private readonly keys: KeysService,
    private readonly prompts: PromptsService,
    private readonly anthropic: AnthropicClient,
  ) {
    super(model);
  }

  async toView(doc: PromptTestDocument): Promise<PromptTestModel> {
    const refs = await this.users.refMap(promptTestActorIds(doc));
    return toPromptTest(doc, refs);
  }

  async toViews(docs: PromptTestDocument[]): Promise<PromptTestModel[]> {
    const refs = await this.users.refMap(docs.flatMap(promptTestActorIds));
    return docs.map((d) => toPromptTest(d, refs));
  }

  // The prompt must exist in the workspace and be visible to the caller
  // (public, or their own draft) — same rule as the prompt library.
  async assertPromptVisible(
    workspaceId: string,
    promptId: string,
    userId: string,
  ) {
    const prompt = await this.prompts.findActiveById(promptId);
    if (!prompt || prompt.workspaceId !== workspaceId) {
      throw new NotFoundException('Prompt not found');
    }
    if (prompt.status !== PromptStatus.Public && prompt.createdBy !== userId) {
      throw new ForbiddenException('No access to this prompt');
    }
    return prompt;
  }

  listForPrompt(
    workspaceId: string,
    promptId: string,
    filters: { starred?: boolean; tag?: string } = {},
  ) {
    const filter: Record<string, unknown> = { workspaceId, promptId };
    if (filters.starred) filter.starred = true;
    if (filters.tag) filter.tags = filters.tag;
    return this.find(filter, { sort: { createdAt: -1 } });
  }

  // Validate the run request and return the decrypted key. Throws (-> 4xx)
  // before any streaming starts.
  async prepareRun(
    workspaceId: string,
    provider: Provider,
    model: string,
  ): Promise<string> {
    if (!isModelAllowed(provider, model)) {
      throw new BadRequestException(`Unknown model "${model}" for ${provider}`);
    }
    const apiKey = await this.keys.getDecrypted(workspaceId, provider);
    if (!apiKey) {
      throw new BadRequestException(
        `This provider needs the "${provider}" key — add it in Settings.`,
      );
    }
    return apiKey;
  }

  // Execute the model call. Anthropic streams (onDelta per chunk); other
  // providers return a mock result (emitted as one chunk) until their phases.
  async run(
    provider: Provider,
    model: string,
    apiKey: string,
    input: string,
    onDelta: (text: string) => void,
  ): Promise<RunOutput> {
    if (provider === Provider.Anthropic) {
      const out = await this.anthropic.stream(
        { apiKey, model, system: SYSTEM_PROMPT, prompt: input },
        onDelta,
      );
      if (!out.text) throw new Error('Claude returned an empty response');
      return { result: out.text, usage: out.usage };
    }
    const mock = `[mock ${provider}·${model}] response to your prompt.`;
    onDelta(mock);
    return { result: mock, usage: { tokens: 0, costUsd: 0 } };
  }

  record(doc: Partial<PromptTest>) {
    return this.create(doc);
  }
}
