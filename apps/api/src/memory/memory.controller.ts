import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { Memory, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { MemoryService } from './memory.service';
import { RememberBody, RecallBody } from './dto/memory.dto';

@Controller('workspaces/:id/memory')
@UseGuards(WorkspaceGuard)
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@Param('id') ws: string): Promise<Memory[]> { return this.memory.list(ws); }

  @Post()
  @RequireCreate()
  remember(@Param('id') ws: string, @Body() body: RememberBody, @CurrentUser() user: User): Promise<Memory> {
    return this.memory.remember(ws, body, user.id);
  }

  @Post('recall')
  @HttpCode(200)
  recall(@Param('id') ws: string, @Body() body: RecallBody): Promise<Memory[]> {
    return this.memory.recall(ws, body);
  }

  @Delete(':memoryId')
  @RequireCreate()
  @HttpCode(204)
  async forget(@Param('id') ws: string, @Param('memoryId') memoryId: string, @CurrentUser() user: User): Promise<void> {
    await this.memory.forget(memoryId, ws, user.id);
  }
}
