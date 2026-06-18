import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { CopilotResponse, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { CopilotService } from './copilot.service';
import { CopilotChatBody } from './dto/copilot.dto';

@Controller()
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  // One copilot turn. The conversation is sent each time (ephemeral — not stored
  // server-side); the copilot reads the workspace via tools to answer.
  @Post('workspaces/:id/copilot')
  @UseGuards(WorkspaceGuard)
  async chat(
    @Param('id') workspaceId: string,
    @Body() body: CopilotChatBody,
    @CurrentUser() user: User,
  ): Promise<CopilotResponse> {
    return this.copilot.chat(workspaceId, user.id, body.messages);
  }
}
