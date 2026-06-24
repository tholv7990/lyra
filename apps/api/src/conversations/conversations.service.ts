import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Provider,
  type Conversation as ConversationModel,
  type ConversationMessage,
  type ConversationSummary,
  type PromptMedia,
} from '@lyra/shared';
import { Conversation } from './conversation.schema';
import type { ConversationDocument } from './conversation.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { KeysService } from '../keys/keys.service';
import { FilesService } from '../files/files.service';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import type { LlmAttachment, LlmTurn } from '../runs/providers/anthropic.client';
import { OpenAiCompatClient, compatBaseUrl } from '../runs/providers/openai-compat.client';
import { MemoryService } from '../memory/memory.service';
import {
  conversationActorIds,
  toConversation,
  toConversationMessage,
  toConversationSummary,
  type PersistedMsg,
} from './conversation.views';

const CHAT_SYSTEM =
  'You are Lyra, a helpful AI assistant for crafting and testing prompts. ' +
  'Respond directly and helpfully, returning well-structured Markdown.';

// Append a compact, budgeted block of recalled memories to the system prompt so the
// assistant has cross-session context. Non-LLM (recall is keyword/recency). Capped tight
// for chat (≤8); recall already enforces the token budget. Empty → unchanged base prompt.
function withMemories(base: string, mems: { kind: string; text: string }[]): string {
  if (!mems.length) return base;
  const lines = mems.slice(0, 8).map((m) => `- [${m.kind}] ${m.text}`).join('\n');
  return `${base}\n\n## What you remember about this workspace\n(Use only if relevant to the user's message; never repeat this list verbatim.)\n${lines}`;
}

// A new turn to append (plain shape — Mongoose builds the subdoc on save).
interface NewMsg {
  role: 'user' | 'assistant';
  content: string;
  media: PromptMedia[];
  provider: Provider;
  model: string;
  usage?: { tokens?: number; costUsd?: number };
  error?: string;
}

interface CallOutput {
  result: string;
  usage?: { tokens?: number; costUsd?: number };
  aborted?: boolean;
}

// Derive a chat title from the first user message (first line, capped).
function deriveTitle(content: string): string {
  const first = content.trim().split('\n')[0].trim();
  if (!first) return 'New chat';
  return first.length > 48 ? `${first.slice(0, 48).trimEnd()}…` : first;
}

@Injectable()
export class ConversationsService extends BaseRepository<Conversation> {
  constructor(
    @InjectModel(Conversation.name) model: Model<Conversation>,
    private readonly users: UsersService,
    private readonly keys: KeysService,
    private readonly files: FilesService,
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
    private readonly memory: MemoryService,
  ) {
    super(model);
  }

  async toView(doc: ConversationDocument): Promise<ConversationModel> {
    const refs = await this.users.refMap(conversationActorIds(doc));
    return toConversation(doc, refs);
  }

  toSummaries(docs: ConversationDocument[]): ConversationSummary[] {
    return docs.map(toConversationSummary);
  }

  // The caller's chats in a workspace, most-recently-updated first.
  listForUser(workspaceId: string, userId: string) {
    return this.find(
      { workspaceId, createdBy: userId },
      { sort: { updatedAt: -1, createdAt: -1 } },
    );
  }

  // Active chats that originated from a prompt — matched by stamped
  // originPromptId or by a legacy first user message equal to the prompt body.
  private promptHistoryFilter(
    workspaceId: string,
    userId: string,
    promptId: string,
    content: string,
  ) {
    return this.active({
      workspaceId,
      createdBy: userId,
      $or: [
        { originPromptId: promptId },
        { 'messages.0.role': 'user', 'messages.0.content': content },
      ],
    });
  }

  findForPrompt(workspaceId: string, userId: string, promptId: string, content: string) {
    return this.model
      .findOne(this.promptHistoryFilter(workspaceId, userId, promptId, content), null, {
        sort: { updatedAt: -1, createdAt: -1 },
      })
      .exec();
  }

  // Validate provider/model and return the decrypted key — throws (-> 4xx)
  // before any streaming starts.
  async prepareRun(workspaceId: string, provider: Provider, model: string): Promise<string> {
    if (!model?.trim()) {
      throw new BadRequestException('Choose a model to run.');
    }
    const apiKey = await this.keys.getDecrypted(workspaceId, provider);
    if (!apiKey) {
      throw new BadRequestException(
        `This provider needs the "${provider}" key — add it in Settings.`,
      );
    }
    return apiKey;
  }

  // Turn stored media into model attachments (images + PDFs, base64). Other
  // types stay on the record but aren't sent to the model. Capped for sane payloads.
  private async buildAttachments(media: PromptMedia[]): Promise<LlmAttachment[]> {
    const out: LlmAttachment[] = [];
    for (const m of media.slice(0, 5)) {
      const mime = m.mime ?? '';
      const isImage = mime.startsWith('image/');
      const isPdf = mime === 'application/pdf';
      if (!isImage && !isPdf) continue;
      const id = m.url.split('/').pop();
      if (!id) continue;
      try {
        const buf = await this.files.readBuffer(id);
        out.push({
          kind: isImage ? 'image' : 'document',
          mediaType: mime,
          dataBase64: buf.toString('base64'),
        });
      } catch {
        // skip unreadable attachments
      }
    }
    return out;
  }

  // Append the user turn, stream the assistant reply with prior turns as
  // context, persist the assistant turn, and return its view. The user turn is
  // saved before generating so it survives a failure mid-stream.
  async streamReply(
    convo: ConversationDocument,
    dto: { provider: Provider; model: string; content: string; media: PromptMedia[] },
    apiKey: string,
    userId: string,
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<{ assistant?: ConversationMessage; title: string; aborted?: boolean }> {
    const msgs = convo.messages as unknown as NewMsg[];
    // History = prior successful turns, text only (current turn carries media).
    const history: LlmTurn[] = (convo.messages as unknown as NewMsg[])
      .filter((m) => m.content && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    // Persist the user turn first.
    msgs.push({
      role: 'user',
      content: dto.content,
      media: dto.media,
      provider: dto.provider,
      model: dto.model,
    });
    if (!convo.title || convo.title === 'New chat') convo.title = deriveTitle(dto.content);
    convo.updatedBy = userId;
    await convo.save();

    // Recall-on-start: pull workspace-shared + this user's own memories (non-LLM,
    // keyword-ranked on the message) and fold them into the system prompt. Best-effort —
    // a memory failure must never break the reply.
    const recalled = await this.memory
      .recall(convo.workspaceId, { query: dto.content }, userId)
      .catch(() => [] as { kind: string; text: string }[]);
    const system = withMemories(CHAT_SYSTEM, recalled);

    let out: CallOutput;
    try {
      out = await this.callModel(
        dto.provider,
        dto.model,
        apiKey,
        system,
        dto.content,
        dto.media,
        history,
        onDelta,
        signal,
      );
    } catch (err) {
      // Persist the failure so the thread shows it on reload, then rethrow so
      // the controller emits an error event.
      const message = err instanceof Error ? err.message : 'Chat failed';
      msgs.push({
        role: 'assistant',
        content: '',
        media: [],
        provider: dto.provider,
        model: dto.model,
        error: message,
      });
      convo.updatedBy = userId;
      await convo.save();
      throw err;
    }

    // Stopped before any text — keep only the user turn.
    if (out.aborted && !out.result) {
      return { title: convo.title, aborted: true };
    }

    msgs.push({
      role: 'assistant',
      content: out.result,
      media: [],
      provider: dto.provider,
      model: dto.model,
      usage: out.usage,
    });
    convo.updatedBy = userId;
    await convo.save();

    const persisted = convo.messages[convo.messages.length - 1] as unknown as PersistedMsg;
    return {
      assistant: toConversationMessage(persisted),
      title: convo.title,
    };
  }

  // Provider dispatch (streaming). Anthropic + OpenAI/DeepSeek are real; image/
  // video return a mock until their phases.
  private async callModel(
    provider: Provider,
    model: string,
    apiKey: string,
    system: string,
    input: string,
    media: PromptMedia[],
    history: LlmTurn[],
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<CallOutput> {
    if (provider === Provider.Anthropic) {
      const attachments = await this.buildAttachments(media);
      const out = await this.anthropic.stream(
        { apiKey, model, system, prompt: input, history, attachments, signal },
        onDelta,
      );
      if (!out.text && !out.aborted) throw new Error('Claude returned an empty response');
      return { result: out.text, usage: out.usage, aborted: out.aborted };
    }

    const baseUrl = compatBaseUrl(provider);
    if (baseUrl) {
      const attachments =
        provider === Provider.OpenAI ? await this.buildAttachments(media) : [];
      const out = await this.openai.stream(
        { baseUrl, provider, apiKey, model, system, prompt: input, history, attachments, signal },
        onDelta,
      );
      if (!out.text && !out.aborted) throw new Error(`No response from ${provider}`);
      return { result: out.text, usage: out.usage, aborted: out.aborted };
    }

    const mock = `[mock ${provider}·${model}] response to your message.`;
    onDelta(mock);
    return { result: mock, usage: { tokens: 0, costUsd: 0 } };
  }
}
