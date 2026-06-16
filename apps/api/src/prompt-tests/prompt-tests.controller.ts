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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  dedupeTags,
  Role,
  type PromptTest as PromptTestModel,
  type User,
} from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { MembershipsService } from '../workspaces/memberships.service';
import { PromptTestsService } from './prompt-tests.service';
import type { PromptTestDocument } from './prompt-test.schema';
import {
  CreatePromptTestBody,
  UpdatePromptTestBody,
} from './dto/prompt-tests.dto';

@Controller()
export class PromptTestsController {
  constructor(
    private readonly tests: PromptTestsService,
    private readonly memberships: MembershipsService,
  ) {}

  // Run a test — streams the model output as Server-Sent Events:
  //   {type:'delta', text}        per chunk
  //   {type:'done',  test}        on success (the saved PromptTest)
  //   {type:'error', message, test?}  on failure (also persisted to history)
  @Post('workspaces/:id/prompts/:promptId/tests')
  @UseGuards(WorkspaceGuard)
  async run(
    @Param('id') workspaceId: string,
    @Param('promptId') promptId: string,
    @Body() body: CreatePromptTestBody,
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    // Validate before opening the stream (these surface as normal 4xx).
    await this.tests.assertPromptVisible(workspaceId, promptId, user.id);
    const apiKey = await this.tests.prepareRun(workspaceId, body.provider, body.model);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    const media = body.media ?? [];
    const base = {
      workspaceId,
      promptId,
      createdBy: user.id,
      updatedBy: user.id,
      provider: body.provider,
      model: body.model,
      input: body.input,
      media,
      starred: false,
      tags: [] as string[],
    };

    try {
      const out = await this.tests.run(
        body.provider,
        body.model,
        apiKey,
        body.input,
        media,
        (text) => send({ type: 'delta', text }),
      );
      const saved = await this.tests.record({
        ...base,
        result: out.result,
        usage: out.usage,
      });
      send({ type: 'done', test: await this.tests.toView(saved) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed';
      try {
        const saved = await this.tests.record({ ...base, result: '', error: message });
        send({ type: 'error', message, test: await this.tests.toView(saved) });
      } catch {
        send({ type: 'error', message });
      }
    } finally {
      res.end();
    }
  }

  @Get('workspaces/:id/prompts/:promptId/tests')
  @UseGuards(WorkspaceGuard)
  async list(
    @Param('id') workspaceId: string,
    @Param('promptId') promptId: string,
    @CurrentUser() user: User,
    @Query('starred') starred?: string,
    @Query('tag') tag?: string,
  ): Promise<PromptTestModel[]> {
    await this.tests.assertPromptVisible(workspaceId, promptId, user.id);
    const docs = await this.tests.listForPrompt(workspaceId, promptId, {
      starred: starred === 'true',
      tag,
    });
    return this.tests.toViews(docs);
  }

  @Patch('prompt-tests/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePromptTestBody,
    @CurrentUser() user: User,
  ): Promise<PromptTestModel> {
    const test = await this.requireModifiable(id, user.id);
    const patch: Record<string, unknown> = { updatedBy: user.id };
    if (body.starred !== undefined) patch.starred = body.starred;
    if (body.tags !== undefined) patch.tags = dedupeTags(body.tags);
    const updated = await this.tests.findByIdAndUpdate(test._id.toString(), patch);
    return this.tests.toView(updated!);
  }

  @Delete('prompt-tests/:id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    const test = await this.requireModifiable(id, user.id);
    await this.tests.softDelete(test._id.toString(), user.id);
  }

  // Loads the test and enforces edit rights: creator or workspace owner.
  private async requireModifiable(
    id: string,
    userId: string,
  ): Promise<PromptTestDocument> {
    const test = await this.tests.findById(id);
    if (!test) throw new NotFoundException('Test not found');
    const membership = await this.memberships.findFor(test.workspaceId, userId);
    if (!membership) throw new ForbiddenException('Not a member of this workspace');
    if (test.createdBy !== userId && membership.role !== Role.Owner) {
      throw new ForbiddenException('Cannot modify this test');
    }
    return test;
  }
}
