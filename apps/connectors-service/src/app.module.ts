import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DownloadModule } from './download/download.module';
import { PublishModule } from './publish/publish.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DownloadModule, PublishModule],
  controllers: [HealthController],
})
export class AppModule {}
