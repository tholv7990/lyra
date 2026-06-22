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
    // Join creatives + brands for the events in range (one query each), then group
    // day → competitor → {new, stopped}. `ongoing` is a current-state concept (the live
    // still-running set is read per-competitor via GET /monitor/ads — spec §4 storage model).
    const cids = [...new Set(evs.map((e) => e.competitorId))];
    const adIds = [...new Set(evs.map((e) => e.adId))];
    const brandById = new Map(
      (await this.competitors.find({ workspaceId: ws, _id: { $in: cids } }).exec()).map(
        (c) => [String((c as { _id: unknown })._id), c.brand] as const,
      ),
    );
    const adByKey = new Map(
      (await this.ads.find({ workspaceId: ws, adId: { $in: adIds } }).exec()).map(
        (a) => [`${a.competitorId}:${a.adId}`, a] as const,
      ),
    );
    const dates = [...new Set(evs.map((e) => e.date))].sort().reverse();
    const byDay = dates.map((date) => {
      const dayEvs = evs.filter((e) => e.date === date);
      const dayCids = [...new Set(dayEvs.map((e) => e.competitorId))];
      const competitors = dayCids.map((cid) => {
        const pick = (event: AdEventType) =>
          dayEvs
            .filter((e) => e.competitorId === cid && e.event === event)
            .map((e) => adByKey.get(`${cid}:${e.adId}`))
            .filter(Boolean);
        return {
          competitorId: cid,
          brand: brandById.get(cid) ?? 'Unknown',
          newAds: pick(AdEventType.New),
          ongoing: [],
          stopped: pick(AdEventType.Stopped),
        };
      }) as unknown as CompetitorChangelog[];
      return { date, competitors };
    });
    return { stats, byDay };
  }

  async remove(ws: string, competitorId: string): Promise<{ ok: true }> {
    const c = await this.competitors.findById(competitorId).exec();
    if (!c || c.workspaceId !== ws) throw new NotFoundException('competitor not found');
    await Promise.all([
      this.competitors.deleteOne({ _id: competitorId }).exec(),
      this.handles.deleteMany({ workspaceId: ws, competitorId }).exec(),
      this.ads.deleteMany({ workspaceId: ws, competitorId }).exec(),
      this.events.deleteMany({ workspaceId: ws, competitorId }).exec(),
    ]);
    return { ok: true };
  }

  adsForCompetitor(ws: string, competitorId: string) {
    return this.ads.find({ workspaceId: ws, competitorId, status: AdStatus.Active }).sort({ daysRunning: -1 }).exec();
  }
}
