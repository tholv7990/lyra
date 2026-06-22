import { Module } from '@nestjs/common';
import { RenderService } from './render.service';
import { RenderStore } from './render.store';
import { RenderController } from './render.controller';

@Module({
  controllers: [RenderController],
  providers: [RenderService, RenderStore],
})
export class RenderModule {}
