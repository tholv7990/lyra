import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ChannelType,
  type Channel as ChannelView,
  type CreateChannelDto,
  type PublishJob,
  type Receipt,
} from '@lyra/shared';
import { Channel, ChannelDocument } from './channel.schema';
import { PublishedPost } from '../posts/post.schema';
import { ConnectorsProxy } from '../connectors/connectors.proxy';
import { ConnectorCredentialsService } from '../connectors/connector-credentials.service';
import { DispatchStore, type DispatchTarget } from './dispatch-store';
import { iso } from '../common/dates';

const POSTIZ = 'postiz';

interface PublishInput { channelIds: string[]; caption: string; mediaUrls: string[] }
interface ChannelStats { postCount: number; lastPostAt?: string }

@Injectable()
export class ChannelsService {
  private readonly dispatch = new DispatchStore(900_000);

  constructor(
    @InjectModel(Channel.name) private readonly model: Model<Channel>,
    @InjectModel(PublishedPost.name) private readonly posts: Model<PublishedPost>,
    private readonly proxy: ConnectorsProxy,
    private readonly credentials: ConnectorCredentialsService,
  ) {
    setInterval(() => this.dispatch.sweep(), 60_000).unref();
  }

  // The unified channel list: live Postiz pool (auto-imported, type=postiz) + the
  // workspace's stored channels (GoLogin, type=gologin), each with its post stats.
  async list(workspaceId: string, userId: string): Promise<ChannelView[]> {
    const [postiz, docs, stats] = await Promise.all([
      this.postizChannels(workspaceId, userId),
      this.model.find({ workspaceId, active: { $ne: false } }).sort({ createdAt: -1 }).exec(),
      this.postStats(workspaceId),
    ]);
    const channels = [...postiz, ...docs.map(toChannelView)];
    return channels.map((c) => ({ ...c, postCount: 0, ...stats.get(c.id) }));
  }

  // Per-channel post activity: count + most-recent date, from project posts that
  // targeted the channel. One grouped query over the workspace's posts.
  private async postStats(workspaceId: string): Promise<Map<string, ChannelStats>> {
    const rows = await this.posts.aggregate<{ _id: string; count: number; last: Date }>([
      { $match: { workspaceId, active: { $ne: false } } },
      { $unwind: '$channelIds' },
      { $group: { _id: '$channelIds', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
    ]);
    const map = new Map<string, ChannelStats>();
    for (const r of rows) {
      map.set(r._id, { postCount: r.count, lastPostAt: r.last ? iso(r.last) : undefined });
    }
    return map;
  }

  async create(workspaceId: string, actorId: string, dto: CreateChannelDto): Promise<ChannelView> {
    const doc = await this.model.create({
      workspaceId,
      type: ChannelType.GoLogin,
      platform: dto.platform.trim(),
      displayName: dto.displayName.trim(),
      profileId: dto.profileId.trim(),
      ...(dto.proxy ? { proxy: dto.proxy.trim() } : {}),
      createdBy: actorId,
      updatedBy: actorId,
    });
    return toChannelView(doc);
  }

  // Route a publish by channel type: Postiz channels → the Postiz publish job;
  // each GoLogin channel → its own browser-connector job. Returns one composite
  // dispatch id the caller polls via job().
  async publish(workspaceId: string, userId: string, input: PublishInput): Promise<{ jobId: string; status: PublishJob['status'] }> {
    const all = await this.list(workspaceId, userId);
    const picked = input.channelIds
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is ChannelView => !!c);
    const postiz = picked.filter((c) => c.type === ChannelType.Postiz);
    const gologin = picked.filter((c) => c.type === ChannelType.GoLogin);

    const targets: DispatchTarget[] = [];
    const immediate: Receipt[] = [];

    if (postiz.length) {
      try {
        const key = (await this.credentials.getDecrypted(workspaceId, POSTIZ)) ?? undefined;
        const res = (await this.proxy.forward(workspaceId, userId, 'POST', 'publish', {
          channelIds: postiz.map((c) => c.id),
          caption: input.caption,
          mediaUrls: input.mediaUrls,
        }, key)) as { jobId?: string };
        if (res?.jobId) targets.push({ kind: 'postiz', jobId: res.jobId, channelIds: postiz.map((c) => c.id) });
        else postiz.forEach((c) => immediate.push(fail(c, 'no job started')));
      } catch (e) {
        postiz.forEach((c) => immediate.push(fail(c, errMsg(e))));
      }
    }

    for (const c of gologin) {
      try {
        const res = (await this.proxy.forward(workspaceId, userId, 'POST', 'browser/publish', {
          platform: c.platform,
          profileId: c.profileId,
          caption: input.caption,
          mediaUrls: input.mediaUrls,
        })) as { jobId?: string };
        if (res?.jobId) targets.push({ kind: 'browser', jobId: res.jobId, channelIds: [c.id] });
        else immediate.push(fail(c, 'no job started'));
      } catch (e) {
        immediate.push(fail(c, errMsg(e)));
      }
    }

    const jobId = this.dispatch.create(targets, immediate);
    return { jobId, status: 'queued' };
  }

  // Aggregate the composite dispatch's sub-jobs into one PublishJob (status + receipts).
  async job(workspaceId: string, userId: string, jobId: string): Promise<PublishJob> {
    const entry = this.dispatch.get(jobId);
    if (!entry) return { jobId, status: 'failed', receipts: [] };
    const subs = await Promise.all(
      entry.targets.map(async (tgt): Promise<PublishJob> => {
        try {
          const path = tgt.kind === 'browser' ? `browser/jobs/${tgt.jobId}` : `jobs/${tgt.jobId}`;
          return (await this.proxy.forward(workspaceId, userId, 'GET', path)) as unknown as PublishJob;
        } catch {
          return { jobId: tgt.jobId, status: 'failed', receipts: [] };
        }
      }),
    );
    const receipts = [...entry.immediate, ...subs.flatMap((s) => s.receipts ?? [])];
    const done = subs.every((s) => s.status === 'done' || s.status === 'failed');
    return { jobId, status: done ? 'done' : 'running', receipts };
  }

  async remove(workspaceId: string, id: string, actorId: string): Promise<void> {
    await this.model
      .findOneAndUpdate(
        { _id: id, workspaceId, active: { $ne: false } },
        { $set: { active: false, updatedBy: actorId } },
      )
      .exec();
  }

  // Postiz pool → channel views. Best-effort: any error (no key / service down) just
  // means no Postiz channels, the GoLogin ones still list.
  private async postizChannels(workspaceId: string, userId: string): Promise<ChannelView[]> {
    try {
      const key = (await this.credentials.getDecrypted(workspaceId, POSTIZ)) ?? undefined;
      const res = (await this.proxy.forward(workspaceId, userId, 'GET', 'channels', undefined, key)) as {
        channels?: Array<{ id: string; platform: string; displayName: string }>;
      };
      return (res.channels ?? []).map((c) => ({
        id: c.id,
        type: ChannelType.Postiz,
        platform: c.platform,
        displayName: c.displayName,
      }));
    } catch {
      return [];
    }
  }
}

function fail(c: ChannelView, error: string): Receipt {
  return { platform: c.platform, accountId: c.id, status: 'failed', error };
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'publish failed';
}

function toChannelView(d: ChannelDocument): ChannelView {
  return {
    id: d._id.toString(),
    type: d.type as ChannelType,
    platform: d.platform,
    displayName: d.displayName,
    profileId: d.profileId,
    proxy: d.proxy,
    createdAt: iso(d.createdAt),
  };
}
