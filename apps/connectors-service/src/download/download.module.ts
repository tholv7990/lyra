import { Module } from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';

@Module({
  controllers: [DownloadController],
  providers: [DownloadService, ServiceTokenGuard],
})
export class DownloadModule {}
