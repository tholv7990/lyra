import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompetitorStatus, MonitorPlatform, type Competitor as CompetitorModel } from '@lyra/shared';
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
}
