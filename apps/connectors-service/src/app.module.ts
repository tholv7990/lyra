import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DownloadModule } from './download/download.module';
import { PublishModule } from './publish/publish.module';
import { BrowserModule } from './browser/browser.module';
import { AdlibraryModule } from './adlibrary/adlibrary.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DownloadModule, PublishModule, BrowserModule, AdlibraryModule],
  controllers: [HealthController],
})
export class AppModule {}
