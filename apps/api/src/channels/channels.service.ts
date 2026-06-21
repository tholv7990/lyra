import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChannelType, type Channel as ChannelView, type CreateChannelDto } from '@lyra/shared';
import { Channel, ChannelDocument } from './channel.schema';
import { ConnectorsProxy } from '../connectors/connectors.proxy';
import { ConnectorCredentialsService } from '../connectors/connector-credentials.service';

const POSTIZ = 'postiz';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private readonly model: Model<Channel>,
    private readonly proxy: ConnectorsProxy,
    private readonly credentials: ConnectorCredentialsService,
  ) {}

  // The unified channel list: live Postiz pool (auto-imported, type=postiz) + the
  // workspace's stored channels (GoLogin, type=gologin).
  async list(workspaceId: string, userId: string): Promise<ChannelView[]> {
    const [postiz, docs] = await Promise.all([
      this.postizChannels(workspaceId, userId),
      this.model.find({ workspaceId, active: { $ne: false } }).sort({ createdAt: -1 }).exec(),
    ]);
    return [...postiz, ...docs.map(toChannelView)];
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

function toChannelView(d: ChannelDocument): ChannelView {
  return {
    id: d._id.toString(),
    type: d.type as ChannelType,
    platform: d.platform,
    displayName: d.displayName,
    profileId: d.profileId,
    proxy: d.proxy,
  };
}
