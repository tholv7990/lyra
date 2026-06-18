import { Module } from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  controllers: [PublishController],
  providers: [PublishService, ServiceTokenGuard],
})
export class PublishModule {}
