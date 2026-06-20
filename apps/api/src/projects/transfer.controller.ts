import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { Project as ProjectModel, TransferPreview } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@lyra/shared';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { CurrentProject } from './decorators/project.decorators';
import type { ProjectDocument } from './project.schema';
import { TransferService } from './transfer.service';
import { TransferProjectBody } from './dto/transfer.dto';

@Controller()
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('projects/:id/transfer/preview')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(200)
  preview(
    @Param('id') _id: string,
    @CurrentProject() project: ProjectDocument,
    @CurrentUser() user: User,
    @Body() body: TransferProjectBody,
  ): Promise<TransferPreview> {
    return this.transferService.preview(project, user.id, body);
  }

  @Post('projects/:id/transfer')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(200)
  doTransfer(
    @Param('id') _id: string,
    @CurrentProject() project: ProjectDocument,
    @CurrentUser() user: User,
    @Body() body: TransferProjectBody,
  ): Promise<ProjectModel> {
    return this.transferService.transfer(project, user.id, body, user.id);
  }
}
