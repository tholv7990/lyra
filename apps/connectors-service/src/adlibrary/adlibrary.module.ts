import { Module } from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { AdlibraryController } from './adlibrary.controller';
import { ApifyClient } from './apify.client';
import { MetaCollector } from './meta.collector';

@Module({
  controllers: [AdlibraryController],
  providers: [ApifyClient, MetaCollector, ServiceTokenGuard],
})
export class AdlibraryModule {}
