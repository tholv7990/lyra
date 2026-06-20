import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { LabelInfo, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { LabelsService } from './labels.service';
import { CreateLabelBody } from './dto/labels.dto';

// Workspace-scoped label vocabulary. Any member can read + create labels.
@Controller()
@UseGuards(WorkspaceGuard)
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get('workspaces/:id/labels')
  list(@Param('id') workspaceId: string): Promise<LabelInfo[]> {
    return this.labels.list(workspaceId);
  }

  @Post('workspaces/:id/labels')
  @RequireCreate()
  create(
    @Param('id') workspaceId: string,
    @Body() body: CreateLabelBody,
    @CurrentUser() user: User,
  ): Promise<LabelInfo> {
    return this.labels.create(workspaceId, user.id, body.name, body.color);
  }
}
