import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreatePublishedPostDto, PublishedPost as PublishedPostView } from '@lyra/shared';
import { PublishedPost, PublishedPostDocument } from './post.schema';
import { UsersService } from '../users/users.service';
import { toPostView } from './post.views';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(PublishedPost.name) private readonly model: Model<PublishedPost>,
    private readonly users: UsersService,
  ) {}

  async list(projectId: string): Promise<PublishedPostView[]> {
    const docs = await this.model
      .find({ projectId, active: { $ne: false } })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    const refs = await this.users.refMap(docs.map((d) => d.createdBy));
    return docs.map((d) => toPostView(d, refs));
  }

  async create(
    projectId: string,
    workspaceId: string,
    actorId: string,
    dto: CreatePublishedPostDto,
  ): Promise<PublishedPostView> {
    const targets = dto.targets ?? [];
    const ok = targets.filter((tg) => tg.status === 'ok').length;
    const status = targets.length === 0 || ok === 0 ? 'failed' : ok === targets.length ? 'ok' : 'partial';
    const doc = await this.model.create({
      workspaceId,
      projectId,
      caption: (dto.caption ?? '').slice(0, 5000),
      mediaUrls: dto.mediaUrls ?? [],
      channelIds: dto.channelIds ?? [],
      targets,
      status,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.toView(doc);
  }

  private async toView(doc: PublishedPostDocument): Promise<PublishedPostView> {
    const refs = await this.users.refMap([doc.createdBy]);
    return toPostView(doc, refs);
  }
}
