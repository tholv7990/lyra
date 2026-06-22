import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompetitorStatus } from '@lyra/shared';
import { Competitor } from './monitor.schema';
import { MonitorService } from './monitor.service';

@Injectable()
export class MonitorScheduler {
  private readonly log = new Logger('MonitorScheduler');
  constructor(
    @InjectModel(Competitor.name) private readonly competitors: Model<Competitor>,
    private readonly monitor: MonitorService,
  ) {}

  // ponytail: in-process cron, single api instance. If the api scales out, add a
  // leader lock or move to BullMQ so it doesn't double-run.
  @Cron(process.env.MONITOR_CRON ?? '0 6 * * *')
  async daily(): Promise<void> {
    const wsIds = (await this.competitors.distinct('workspaceId', { status: CompetitorStatus.Watching }).exec()) as string[];
    for (const ws of wsIds) {
      try { await this.monitor.runDaily(ws); } catch (e) { this.log.error(`monitor ws ${ws} failed: ${String(e)}`); }
    }
  }
}
