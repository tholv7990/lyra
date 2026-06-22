import { Controller, Post, Get, Param, Body, UseGuards, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { RenderService, RenderImageRes } from './render.service';
import { RenderStore } from './render.store';
import { RenderImageDto } from './dto';
import { ServiceTokenGuard } from '../auth/service-token.guard';

@Controller()
export class RenderController {
  constructor(private readonly renderService: RenderService, private readonly store: RenderStore) {}

  @Post('render-image')
  @UseGuards(ServiceTokenGuard)
  async renderImage(@Body() dto: RenderImageDto): Promise<RenderImageRes> {
    return this.renderService.renderImage(dto);
  }

  @Get('files/:id')
  serveFile(@Param('id') id: string, @Res() res: Response): void {
    const path = this.store.get(id);
    if (!path) {
      throw new NotFoundException(`file ${id} not found`);
    }
    res.set('Content-Type', 'image/png');
    createReadStream(path).pipe(res);
  }
}
