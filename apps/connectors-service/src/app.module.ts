import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DownloadModule } from './download/download.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DownloadModule],
  controllers: [HealthController],
})
export class AppModule {}
