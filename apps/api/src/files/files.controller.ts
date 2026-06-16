import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MEDIA_MAX_BYTES, type PromptMedia, type User } from '@lyra/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { FilesService, type UploadedFileLike } from './files.service';

@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  // Upload a single attachment into the workspace; returns a PromptMedia the
  // client adds to a prompt's media[].
  @Post('workspaces/:id/files')
  @UseGuards(WorkspaceGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_BYTES } }),
  )
  upload(
    @Param('id') workspaceId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() user: User,
  ): Promise<PromptMedia> {
    return this.files.upload(workspaceId, user.id, file);
  }

  // Serve a file by its (unguessable) id — a capability URL so <img>/links work
  // without auth headers. Phase 6's R2/S3 will use signed URLs in the same slot.
  @Public()
  @SkipThrottle()
  @Get('files/:id')
  async download(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { file, stream } = await this.files.open(id);
    const contentType =
      (file.metadata?.contentType as string) ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.filename)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
    });
    stream.pipe(res);
  }
}
