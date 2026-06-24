import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  scoreMemory,
  estTokens,
  MAX_RECALL_MEMORIES,
  MAX_RECALL_TOKENS,
  type RememberDto,
  type RecallDto,
  type Memory as MemoryView,
} from '@lyra/shared';
import { Memory, MemoryDocument } from './memory.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toMemory, memoryActorIds } from './memory.views';

@Injectable()
export class MemoryService extends BaseRepository<Memory> {
  constructor(
    @InjectModel(Memory.name) model: Model<Memory>,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  private async view(doc: MemoryDocument): Promise<MemoryView> {
    const refs = await this.users.refMap(memoryActorIds(doc));
    return toMemory(doc, refs);
  }

  private async viewMany(docs: MemoryDocument[]): Promise<MemoryView[]> {
    const refs = await this.users.refMap(docs.flatMap(memoryActorIds));
    return docs.map((d) => toMemory(d, refs));
  }

  async remember(workspaceId: string, dto: RememberDto, actorId: string): Promise<MemoryView> {
    let supersedes: string | undefined;
    if (dto.dedupeKey) {
      const userScope = dto.userId
        ? { userId: dto.userId }
        : { userId: { $exists: false } };
      const prior = await this.model
        .findOne({ workspaceId, dedupeKey: dto.dedupeKey, active: { $ne: false }, ...userScope })
        .exec();
      if (prior) {
        await this.model
          .updateOne({ _id: prior._id }, { $set: { active: false, updatedBy: actorId } })
          .exec();
        supersedes = prior._id.toString();
      }
    }
    const doc = await this.model.create({
      workspaceId,
      ...(dto.userId ? { userId: dto.userId } : {}),
      kind: dto.kind,
      text: dto.text,
      ...(dto.subjectType ? { subjectType: dto.subjectType } : {}),
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
      ...(dto.relatedIds ? { relatedIds: dto.relatedIds } : {}),
      ...(dto.dedupeKey ? { dedupeKey: dto.dedupeKey } : {}),
      confidence: dto.confidence ?? 1,
      provenance: dto.provenance ?? 'explicit',
      ...(dto.source ? { source: dto.source } : {}),
      ...(supersedes ? { supersedes } : {}),
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.view(doc as MemoryDocument);
  }

  async recall(workspaceId: string, dto: RecallDto): Promise<MemoryView[]> {
    const filter: Record<string, unknown> = { workspaceId, active: { $ne: false } };
    if (dto.subjectId) filter.subjectId = dto.subjectId;
    if (dto.kinds?.length) filter.kind = { $in: dto.kinds };
    if (dto.userId) filter.userId = dto.userId;

    let docs = (await this.model.find(filter).exec()) as MemoryDocument[];

    if (dto.query) {
      const terms = dto.query.toLowerCase().split(/\s+/).filter(Boolean);
      docs = docs.filter((d) => terms.some((t) => d.text.toLowerCase().includes(t)));
    }

    const now = new Date().toISOString();
    const ranked = docs
      .map((d) => ({ d, score: scoreMemory(toMemory(d, new Map()), { subjectId: dto.subjectId, now }) }))
      .sort((a, b) => b.score - a.score);

    const picked: MemoryDocument[] = [];
    let tokens = 0;
    for (const { d } of ranked) {
      if (picked.length >= MAX_RECALL_MEMORIES) break;
      const t = estTokens(d.text);
      if (tokens + t > MAX_RECALL_TOKENS && picked.length > 0) break;
      picked.push(d);
      tokens += t;
    }

    return this.viewMany(picked);
  }

  async list(workspaceId: string): Promise<MemoryView[]> {
    const docs = (await this.model
      .find({ workspaceId, active: { $ne: false } }, null, { sort: { updatedAt: -1 } })
      .exec()) as MemoryDocument[];
    return this.viewMany(docs);
  }

  async forget(id: string, workspaceId: string, actorId: string): Promise<void> {
    await this.model
      .updateOne({ _id: id, workspaceId }, { $set: { active: false, updatedBy: actorId } })
      .exec();
  }
}
