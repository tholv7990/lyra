import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductStatus,
  type CreateProductDto, type UpdateProductDto, type Product as ProductView,
  type EvidenceClaim, type SourceRow, type UnitEcon, type SubScores, type ConfidenceGrade, type Decision,
  type SaveProductResultDto,
} from '@lyra/shared';
import { Product, ProductDocument } from './product.schema';
import { UsersService } from '../users/users.service';
import { toProductView, productActorIds } from './product.views';

const MAX_NAME = 160;
const MAX_DESC = 4000;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly model: Model<Product>,
    private readonly users: UsersService,
  ) {}

  async list(workspaceId: string): Promise<ProductView[]> {
    const docs = await this.model
      .find({ workspaceId, active: { $ne: false } })
      .sort({ createdAt: -1 })
      .exec();
    return this.toViews(docs);
  }

  async create(workspaceId: string, actorId: string, dto: CreateProductDto): Promise<ProductView> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('A product name is required.');
    const doc = await this.model.create({
      workspaceId,
      name: name.slice(0, MAX_NAME),
      description: (dto.description ?? '').trim().slice(0, MAX_DESC),
      status: dto.status ?? ProductStatus.Candidate,
      ...(dto.source ? { source: dto.source } : {}),
      ...(dto.niche ? { niche: dto.niche } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.econInputs ? { econInputs: dto.econInputs } : {}),
      ...(dto.outcome ? { outcome: dto.outcome } : {}),
      images: dto.images ?? [],
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.compareAtPrice !== undefined ? { compareAtPrice: dto.compareAtPrice } : {}),
      ...(dto.offer ? { offer: dto.offer } : {}),
      competitorIds: dto.competitorIds ?? [],
      tags: dto.tags ?? [],
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.toView(doc);
  }

  async selectIntoProject(workspaceId: string, projectId: string, poolProductId: string, actorId: string): Promise<ProductView> {
    const pool = await this.model.findOne({ _id: poolProductId, workspaceId, projectId: { $exists: false }, active: { $ne: false } }).exec();
    if (!pool) throw new NotFoundException('Pool product not found.');
    const doc = await this.model.create({
      workspaceId, projectId, poolProductId,
      name: pool.name, description: pool.description ?? '',
      ...(pool.source ? { source: pool.source } : {}),
      ...(pool.niche ? { niche: pool.niche } : {}),
      ...(pool.category ? { category: pool.category } : {}),
      images: pool.images ?? [],
      ...(pool.price !== undefined ? { price: pool.price } : {}),
      ...(pool.compareAtPrice !== undefined ? { compareAtPrice: pool.compareAtPrice } : {}),
      ...(pool.offer ? { offer: pool.offer } : {}),
      status: ProductStatus.Candidate,
      poolSnapshotAt: new Date().toISOString(),
      competitorIds: [], tags: [], createdBy: actorId, updatedBy: actorId,
    });
    return this.toView(doc);
  }

  async listForProject(workspaceId: string, projectId: string): Promise<ProductView[]> {
    const copies = await this.model.find({ workspaceId, projectId, active: { $ne: false } }).sort({ createdAt: -1 }).exec();
    const poolIds = copies.map((c) => c.poolProductId).filter((x): x is string => !!x);
    const pools = poolIds.length ? await this.model.find({ _id: { $in: poolIds }, workspaceId }).exec() : [];
    const poolById = new Map(pools.map((p) => [p._id.toString(), p]));
    const refs = await this.users.refMap(copies.flatMap((d) => [d.createdBy, d.updatedBy]));
    return copies.map((c) => {
      const view = toProductView(c, refs);
      const pool = c.poolProductId ? poolById.get(c.poolProductId) : undefined;
      view.drift = !!pool && driftsFrom(c, pool);
      return view;
    });
  }

  async refreshCopy(copyId: string, workspaceId: string, projectId: string, actorId: string): Promise<ProductView> {
    const copy = await this.model.findOne({ _id: copyId, workspaceId, projectId, active: { $ne: false } }).exec();
    if (!copy?.poolProductId) throw new NotFoundException('Product copy not found.');
    const pool = await this.model.findOne({ _id: copy.poolProductId, workspaceId, projectId: { $exists: false } }).exec();
    if (!pool) throw new NotFoundException('Pool product not found.');
    copy.name = pool.name; copy.images = pool.images ?? []; copy.category = pool.category; copy.source = pool.source;
    copy.niche = pool.niche; copy.description = pool.description ?? '';
    copy.poolSnapshotAt = new Date().toISOString(); copy.updatedBy = actorId;
    await copy.save();
    return this.toView(copy);
  }

  async unselect(copyId: string, workspaceId: string, projectId: string, actorId: string): Promise<void> {
    await this.model.findOneAndUpdate({ _id: copyId, workspaceId, projectId, active: { $ne: false } }, { $set: { active: false, updatedBy: actorId } }).exec();
  }

  async applyResearch(productId: string, workspaceId: string, actorId: string, p: {
    evidence?: EvidenceClaim[]; sources?: SourceRow[]; unitEcon?: UnitEcon;
    subScores?: SubScores; score?: number; grade?: ConfidenceGrade; decision?: Decision;
  }): Promise<ProductView> {
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (p.evidence !== undefined) set.evidence = p.evidence;
    if (p.sources !== undefined) set.sources = p.sources;
    if (p.unitEcon !== undefined) set.unitEcon = p.unitEcon;
    if (p.subScores !== undefined) set.subScores = p.subScores;
    if (p.score !== undefined) set.score = p.score;
    if (p.grade !== undefined) set.grade = p.grade;
    if (p.decision !== undefined) set.decision = p.decision;
    const doc = await this.model
      .findOneAndUpdate({ _id: productId, workspaceId, active: { $ne: false } }, { $set: set }, { returnDocument: 'after' })
      .exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  async get(id: string, workspaceId: string): Promise<ProductView> {
    const doc = await this.model.findOne({ _id: id, workspaceId, active: { $ne: false } }).exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  async update(id: string, workspaceId: string, actorId: string, dto: UpdateProductDto): Promise<ProductView> {
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (dto.name !== undefined) set.name = dto.name.trim().slice(0, MAX_NAME);
    if (dto.description !== undefined) set.description = dto.description.trim().slice(0, MAX_DESC);
    if (dto.source !== undefined) set.source = dto.source;
    if (dto.niche !== undefined) set.niche = dto.niche;
    if (dto.category !== undefined) set.category = dto.category;
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.econInputs !== undefined) set.econInputs = dto.econInputs;
    if (dto.competitorIds !== undefined) set.competitorIds = dto.competitorIds;
    if (dto.outcome !== undefined) set.outcome = dto.outcome;
    if (dto.tags !== undefined) set.tags = dto.tags;
    if (dto.images !== undefined) set.images = dto.images;
    if (dto.price !== undefined) set.price = dto.price;
    if (dto.compareAtPrice !== undefined) set.compareAtPrice = dto.compareAtPrice;
    if (dto.offer !== undefined) set.offer = dto.offer;

    const doc = await this.model
      .findOneAndUpdate({ _id: id, workspaceId, active: { $ne: false } }, { $set: set }, { returnDocument: 'after' })
      .exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  // ===== Saved results (branding / run outputs) =====

  async addResult(productId: string, workspaceId: string, userId: string, dto: SaveProductResultDto): Promise<ProductView> {
    const doc = await this.model.findOne({ _id: productId, workspaceId, active: { $ne: false } }).exec();
    if (!doc) throw new NotFoundException('Product not found.');
    doc.results.push({
      output: dto.output, provider: dto.provider, model: dto.model,
      assetUrl: dto.assetUrl, assetType: dto.assetType, runId: dto.runId, stepIndex: dto.stepIndex,
      createdBy: userId, savedAt: new Date(),
    } as never);
    doc.updatedBy = userId;
    await doc.save();
    return this.toView(doc);
  }

  async removeResult(productId: string, workspaceId: string, userId: string, resultId: string): Promise<ProductView> {
    const doc = await this.model.findOne({ _id: productId, workspaceId, active: { $ne: false } }).exec();
    if (!doc) throw new NotFoundException('Product not found.');
    const results = doc.results as unknown as Array<{ _id: { toString(): string }; createdBy: string }>;
    const idx = results.findIndex((r) => r._id.toString() === resultId);
    if (idx === -1) throw new NotFoundException('Result not found.');
    if (results[idx].createdBy !== userId && doc.createdBy !== userId) throw new ForbiddenException('Cannot remove this result.');
    doc.results.splice(idx, 1);
    doc.updatedBy = userId;
    await doc.save();
    return this.toView(doc);
  }

  async remove(id: string, workspaceId: string, actorId: string): Promise<void> {
    await this.model
      .findOneAndUpdate({ _id: id, workspaceId, active: { $ne: false } }, { $set: { active: false, updatedBy: actorId } })
      .exec();
  }

  private async toView(doc: ProductDocument): Promise<ProductView> {
    const refs = await this.users.refMap(productActorIds(doc));
    return toProductView(doc, refs);
  }

  private async toViews(docs: ProductDocument[]): Promise<ProductView[]> {
    const refs = await this.users.refMap(docs.flatMap(productActorIds));
    return docs.map((d) => toProductView(d, refs));
  }
}

function driftsFrom(
  copy: { name: string; category?: string; images: string[]; source?: { url?: string; platform?: string }; niche?: string; description?: string },
  pool: { name: string; category?: string; images: string[]; source?: { url?: string; platform?: string }; niche?: string; description?: string },
): boolean {
  return copy.name !== pool.name
    || (copy.category ?? '') !== (pool.category ?? '')
    || JSON.stringify(copy.images ?? []) !== JSON.stringify(pool.images ?? [])
    || JSON.stringify(copy.source ?? {}) !== JSON.stringify(pool.source ?? {})
    || (copy.niche ?? '') !== (pool.niche ?? '')
    || (copy.description ?? '') !== (pool.description ?? '');
}
