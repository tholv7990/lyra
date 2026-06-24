import { ForbiddenException, Injectable } from '@nestjs/common';
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
    // Privacy: a personal memory belongs to the actor — you can never write one for
    // someone else. `userId` omitted ⇒ workspace-shared; `userId === actorId` ⇒ personal.
    assertSelf(dto.userId, actorId);
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

  async recall(workspaceId: string, dto: RecallDto, actorId: string): Promise<MemoryView[]> {
    // Privacy: only ever return shared memories + the actor's own personal ones.
    assertSelf(dto.userId, actorId);
    const filter: Record<string, unknown> = { workspaceId, active: { $ne: false }, ...visibilityScope(actorId) };
    if (dto.subjectId) filter.subjectId = dto.subjectId;
    if (dto.kinds?.length) filter.kind = { $in: dto.kinds };

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

  async list(workspaceId: string, actorId: string): Promise<MemoryView[]> {
    const docs = (await this.model
      .find({ workspaceId, active: { $ne: false }, ...visibilityScope(actorId) }, null, { sort: { updatedAt: -1 } })
      .exec()) as MemoryDocument[];
    return this.viewMany(docs);
  }

  async forget(id: string, workspaceId: string, actorId: string): Promise<void> {
    // Only a shared memory (any member) or the actor's own personal one may be forgotten.
    // The visibility scope in the filter makes this atomic; a 0-match means it's gone or
    // belongs to another member — surfaced rather than a silent no-op.
    const res = await this.model
      .updateOne(
        { _id: id, workspaceId, active: { $ne: false }, ...visibilityScope(actorId) },
        { $set: { active: false, updatedBy: actorId } },
      )
      .exec();
    if (!res.matchedCount) {
      throw new ForbiddenException('Memory not found, already removed, or not yours to forget.');
    }
  }
}

// A member sees/manages shared memories (no userId) + their own personal ones (userId === actor).
function visibilityScope(actorId: string): Record<string, unknown> {
  return { $or: [{ userId: { $exists: false } }, { userId: actorId }] };
}

// A personal memory belongs to the actor; you may never read/write/forget another's.
function assertSelf(userId: string | undefined, actorId: string): void {
  if (userId !== undefined && userId !== actorId) {
    throw new ForbiddenException('You can only access your own personal memories.');
  }
}
