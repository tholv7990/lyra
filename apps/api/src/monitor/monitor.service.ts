import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompetitorStatus, MonitorPlatform, AdStatus, AdEventType, computeAdDiff, type Competitor as CompetitorModel, type MonitorStats, type CompetitorChangelog } from '@lyra/shared';
import { Competitor, AdvertiserHandle, MonitorAd, AdEvent } from './monitor.schema';
import { ConnectorsProxy } from '../connectors/connectors.proxy';
import { ConnectorCredentialsService } from '../connectors/connector-credentials.service';

const APIFY = 'apify';

@Injectable()
export class MonitorService {
  constructor(
    @InjectModel(Competitor.name) private readonly competitors: Model<Competitor>,
    @InjectModel(AdvertiserHandle.name) private readonly handles: Model<AdvertiserHandle>,
    @InjectModel(MonitorAd.name) private readonly ads: Model<MonitorAd>,
    @InjectModel(AdEvent.name) private readonly events: Model<AdEvent>,
    private readonly proxy: ConnectorsProxy,
    private readonly creds: ConnectorCredentialsService,
  ) {}

  private async apifyKey(ws: string): Promise<string | undefined> {
    const key = await this.creds.getDecrypted(ws, APIFY);
    if (this.proxy.usesService() && !key) {
      throw new BadRequestException('Add an Apify key in Connections to use the monitor.');
    }
    return key ?? undefined;
  }

  list(ws: string, status?: CompetitorStatus) {
    return this.competitors.find(status ? { workspaceId: ws, status } : { workspaceId: ws }).exec();
  }

  async discover(ws: string, userId: string, keywords: string[]): Promise<Competitor[]> {
    const key = await this.apifyKey(ws);
    const res = (await this.proxy.forward(ws, userId, 'POST', 'adlibrary/search', { keywords }, key)) as {
      advertisers?: { pageId?: string; pageName: string; domain?: string }[];
    };
    const existing = new Set((await this.competitors.find({ workspaceId: ws }).exec()).map((c) => c.brand.toLowerCase()));
    const created: Competitor[] = [];
    for (const a of res.advertisers ?? []) {
      if (existing.has(a.pageName.toLowerCase())) continue;
      existing.add(a.pageName.toLowerCase());
      created.push(
        await this.competitors.create({
          workspaceId: ws, brand: a.pageName, domain: a.domain, niche: keywords.join(', '),
          status: CompetitorStatus.Candidate, createdBy: userId, updatedBy: userId,
          // stash the resolved pageId so approve() can save the handle without re-searching
          lastError: a.pageId ? `pageId:${a.pageId}` : undefined,
        } as Partial<Competitor>),
      );
    }
    return created;
  }

  async approve(ws: string, competitorId: string): Promise<Competitor> {
    const c = await this.competitors.findById(competitorId).exec();
    if (!c || c.workspaceId !== ws) throw new NotFoundException('competitor not found');
    const pageId = c.lastError?.startsWith('pageId:') ? c.lastError.slice('pageId:'.length) : undefined;
    if (pageId) {
      await this.handles.create({
        workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, advertiserId: pageId, resolvedAt: new Date(),
      });
    }
    c.status = CompetitorStatus.Watching;
    c.lastError = undefined;
    await c.save();
    return c;
  }

  async reject(ws: string, competitorId: string): Promise<Competitor> {
    const c = await this.competitors.findById(competitorId).exec();
    if (!c || c.workspaceId !== ws) throw new NotFoundException('competitor not found');
    c.status = CompetitorStatus.Archived;
    await c.save();
    return c;
  }

  static today(): string { return new Date().toISOString().slice(0, 10); }

  async runDailyForCompetitor(ws: string, c: { _id: { toString(): string }; brand: string; save?: () => Promise<unknown> }): Promise<void> {
    const competitorId = c._id.toString();
    const handle = (await this.handles.find({ workspaceId: ws, competitorId, platform: MonitorPlatform.Meta }).exec())[0];
    if (!handle) return;
    const key = await this.apifyKey(ws);
    const today = MonitorService.today();
    const crawled = (await this.proxy.forward(ws, 'system', 'POST', 'adlibrary/ads', { pageId: handle.advertiserId }, key)) as {
      ads?: { adId: string; creativeUrl?: string; copy?: string; format?: string }[];
    };
    const byId = new Map((crawled.ads ?? []).map((a) => [a.adId, a]));
    const active = await this.ads.find({ workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, status: AdStatus.Active }).exec();
    const { newIds, stoppedIds, ongoingIds } = computeAdDiff([...byId.keys()], active.map((a) => a.adId));

    for (const id of newIds) {
      const a = byId.get(id)!;
      await this.ads.create({
        workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, adId: id,
        creativeUrl: a.creativeUrl, copy: a.copy, format: a.format,
        status: AdStatus.Active, firstSeen: today, lastSeen: today, daysRunning: 1,
      });
      await this.events.create({ workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, adId: id, event: AdEventType.New, date: today });
    }
    for (const id of ongoingIds) {
      await this.ads.updateOne(
        { workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, adId: id },
        { $set: { lastSeen: today }, $inc: { daysRunning: 1 } },
      ).exec();
    }
    for (const id of stoppedIds) {
      await this.ads.updateOne(
        { workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, adId: id },
        { $set: { status: AdStatus.Stopped, lastSeen: today } },
      ).exec();
      await this.events.create({ workspaceId: ws, competitorId, platform: MonitorPlatform.Meta, adId: id, event: AdEventType.Stopped, date: today });
    }
  }

  async runDaily(ws: string): Promise<void> {
    const watching = await this.competitors.find({ workspaceId: ws, status: CompetitorStatus.Watching }).exec();
    for (const c of watching) {
      try {
        await this.runDailyForCompetitor(ws, c as never);
        c.lastError = undefined; c.lastCrawledAt = new Date(); await c.save();
      } catch (err) {
        c.lastError = err instanceof Error ? err.message.slice(0, 300) : 'crawl failed';
        c.lastCrawledAt = new Date(); await c.save(); // isolate: one failure never aborts the run
      }
    }
  }

  async changelog(ws: string, days: number): Promise<{ stats: MonitorStats; byDay: { date: string; competitors: CompetitorChangelog[] }[] }> {
    const today = MonitorService.today();
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const evs = await this.events.find({ workspaceId: ws, date: { $gte: since } }).exec();
    const watching = await this.competitors.countDocuments({ workspaceId: ws, status: CompetitorStatus.Watching }).exec();
    const stats: MonitorStats = {
      newToday: evs.filter((e) => e.date === today && e.event === AdEventType.New).length,
      stoppedToday: evs.filter((e) => e.date === today && e.event === AdEventType.Stopped).length,
      watching,
    };
    // Group events by day; resolve ad detail + brand lazily. (MVP: detail join kept simple — the
    // web reads ad rows from the events + a /monitor/ads call per competitor if it needs creatives.)
    const days_ = [...new Set(evs.map((e) => e.date))].sort().reverse();
    const byDay = days_.map((date) => ({ date, competitors: [] as CompetitorChangelog[] }));
    return { stats, byDay };
  }
}
