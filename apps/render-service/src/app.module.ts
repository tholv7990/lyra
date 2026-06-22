import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { RenderModule } from './render/render.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RenderModule],
  controllers: [HealthController],
})
export class AppModule {}
