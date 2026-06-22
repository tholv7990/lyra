import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Competitor, CompetitorSchema, AdvertiserHandle, AdvertiserHandleSchema, MonitorAd, MonitorAdSchema, AdEvent, AdEventSchema } from './monitor.schema';
import { ConnectorsModule } from '../connectors/connectors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { MonitorScheduler } from './monitor.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Competitor.name, schema: CompetitorSchema },
      { name: AdvertiserHandle.name, schema: AdvertiserHandleSchema },
      { name: MonitorAd.name, schema: MonitorAdSchema },
      { name: AdEvent.name, schema: AdEventSchema },
    ]),
    ConnectorsModule,
    WorkspacesModule, // WorkspaceGuard + MembershipsService
  ],
  controllers: [MonitorController],
  providers: [MonitorService, MonitorScheduler],
})
export class MonitorModule {}
