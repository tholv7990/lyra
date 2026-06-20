import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  Conversation as ConversationModel,
  ConversationSummary,
  User,
} from '@lyra/shared';
import { canCreate } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { MembershipsService } from '../workspaces/memberships.service';
import { ConversationsService } from './conversations.service';
import type { ConversationDocument } from './conversation.schema';
import {
  CreateConversationBody,
  FindPromptConversationBody,
  SendChatMessageBody,
  UpdateConversationBody,
} from './dto/conversations.dto';

@Controller()
export class ConversationsController {
  constructor(
    private readonly convos: ConversationsService,
    private readonly memberships: MembershipsService,
  ) {}

  // Create an empty chat (the first message is sent via the streaming endpoint).
  @Post('workspaces/:id/conversations')
  @UseGuards(WorkspaceGuard)
  @RequireCreate()
  async create(
    @Param('id') workspaceId: string,
    @Body() body: CreateConversationBody,
    @CurrentUser() user: User,
  ): Promise<ConversationModel> {
    const doc = await this.convos.create({
      workspaceId,
      title: body.title?.trim() || 'New chat',
      provider: body.provider,
      model: body.model,
      originPromptId: body.originPromptId,
      starred: false,
      messages: [],
      createdBy: user.id,
      updatedBy: user.id,
    });
    return this.convos.toView(doc);
  }

  // The caller's chat history in a workspace (sidebar).
  @Get('workspaces/:id/conversations')
  @UseGuards(WorkspaceGuard)
  async list(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<ConversationSummary[]> {
    const docs = await this.convos.listForUser(workspaceId, user.id);
    return this.convos.toSummaries(docs);
  }

  @Post('workspaces/:id/conversations/prompt-history')
  @UseGuards(WorkspaceGuard)
  async findPromptHistory(
    @Param('id') workspaceId: string,
    @Body() body: FindPromptConversationBody,
    @CurrentUser() user: User,
  ): Promise<ConversationSummary | null> {
    const doc = await this.convos.findForPrompt(workspaceId, user.id, body.promptId, body.content);
    return doc ? this.convos.toSummaries([doc])[0] : null;
  }

  @Get('conversations/:id')
  async get(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ConversationModel> {
    const doc = await this.requireOwn(id, user.id);
    return this.convos.toView(doc);
  }

  // Send a user turn — streams the assistant reply as SSE; both turns persist.
  //   {type:'delta', text}                 per chunk
  //   {type:'done',  message, title}       on success (message = saved reply)
  //   {type:'error', message}              on failure
  @Post('conversations/:id/messages')
  async send(
    @Param('id') id: string,
    @Body() body: SendChatMessageBody,
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const convo = await this.requireOwn(id, user.id);
    // Sending spends the workspace's BYO key. Viewers are read-only and unverified
    // users are limited — neither may send (no WorkspaceGuard on this route, so the
    // gate is applied explicitly here).
    await this.requireCanSpend(convo.workspaceId, user);
    // Validate before opening the stream (these surface as normal 4xx).
    const apiKey = await this.convos.prepareRun(convo.workspaceId, body.provider, body.model);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (obj: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    let settled = false;
    const ac = new AbortController();
    req.on('close', () => {
      if (!settled) ac.abort();
    });

    try {
      const out = await this.convos.streamReply(
        convo,
        {
          provider: body.provider,
          model: body.model,
          content: body.content,
          media: body.media ?? [],
        },
        apiKey,
        user.id,
        (text) => send({ type: 'delta', text }),
        ac.signal,
      );
      send({ type: 'done', message: out.assistant ?? null, title: out.title });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chat failed';
      send({ type: 'error', message });
    } finally {
      settled = true;
      res.end();
    }
  }

  @Patch('conversations/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateConversationBody,
    @CurrentUser() user: User,
  ): Promise<ConversationModel> {
    const convo = await this.requireOwn(id, user.id);
    const patch: Record<string, unknown> = { updatedBy: user.id };
    if (body.title !== undefined) patch.title = body.title.trim() || 'New chat';
    if (body.starred !== undefined) patch.starred = body.starred;
    // Manual "save to history": link this chat to a library prompt.
    if (body.originPromptId !== undefined) patch.originPromptId = body.originPromptId;
    const updated = await this.convos.findByIdAndUpdate(convo._id.toString(), patch);
    return this.convos.toView(updated!);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    const convo = await this.requireOwn(id, user.id);
    await this.convos.softDelete(convo._id.toString(), user.id);
  }

  // Load the chat and enforce access: a member of its workspace, and its creator
  // (chats are private to the person who started them).
  private async requireOwn(id: string, userId: string): Promise<ConversationDocument> {
    const convo = await this.convos.findById(id);
    if (!convo) throw new NotFoundException('Conversation not found');
    const membership = await this.memberships.findFor(convo.workspaceId, userId);
    if (!membership) throw new ForbiddenException('Not a member of this workspace');
    if (convo.createdBy !== userId) throw new ForbiddenException('Not your conversation');
    return convo;
  }

  // Block a Viewer or an unverified user from the AI-spend path (the gate the missing
  // WorkspaceGuard would otherwise apply via @RequireCreate + the verified-email check).
  private async requireCanSpend(workspaceId: string, user: User): Promise<void> {
    if (user.emailVerified === false) {
      throw new ForbiddenException('Confirm your email to send chat messages');
    }
    const m = await this.memberships.findFor(workspaceId, user.id);
    if (m && !canCreate({ userId: user.id, role: m.role, canManageKeys: m.canManageKeys })) {
      throw new ForbiddenException('Viewers cannot send chat messages — ask an owner to change your role');
    }
  }
}
