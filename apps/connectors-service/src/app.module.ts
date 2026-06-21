import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DownloadModule } from './download/download.module';
import { PublishModule } from './publish/publish.module';
import { BrowserModule } from './browser/browser.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DownloadModule, PublishModule, BrowserModule],
  controllers: [HealthController],
})
export class AppModule {}
