import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductStatus,
  type CreateProductDto, type UpdateProductDto, type Product as ProductView,
  type EvidenceClaim, type SourceRow, type UnitEcon, type SubScores, type ConfidenceGrade, type Decision,
} from '@lyra/shared';
import { Product, ProductDocument } from './product.schema';
import { UsersService } from '../users/users.service';
import { toProductView } from './product.views';

const MAX_NAME = 160;
const MAX_DESC = 4000;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly model: Model<Product>,
    private readonly users: UsersService,
  ) {}

  async list(projectId: string): Promise<ProductView[]> {
    const docs = await this.model
      .find({ projectId, active: { $ne: false } })
      .sort({ createdAt: -1 })
      .exec();
    return this.toViews(docs);
  }

  async create(projectId: string, workspaceId: string, actorId: string, dto: CreateProductDto): Promise<ProductView> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('A product name is required.');
    const doc = await this.model.create({
      workspaceId,
      projectId,
      name: name.slice(0, MAX_NAME),
      description: (dto.description ?? '').trim().slice(0, MAX_DESC),
      status: dto.status ?? ProductStatus.Candidate,
      ...(dto.source ? { source: dto.source } : {}),
      ...(dto.niche ? { niche: dto.niche } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.econInputs ? { econInputs: dto.econInputs } : {}),
      ...(dto.outcome ? { outcome: dto.outcome } : {}),
      competitorIds: dto.competitorIds ?? [],
      tags: dto.tags ?? [],
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.toView(doc);
  }

  async saveResearch(projectId: string, workspaceId: string, actorId: string, p: {
    name: string;
    evidence?: EvidenceClaim[];
    sources?: SourceRow[];
    unitEcon?: UnitEcon;
    subScores?: SubScores;
    score?: number;
    grade?: ConfidenceGrade;
    decision?: Decision;
  }): Promise<string> {
    const doc = await this.model.create({
      workspaceId, projectId,
      name: (p.name || 'Researched product').slice(0, MAX_NAME),
      status: ProductStatus.Candidate,
      evidence: p.evidence ?? [], sources: p.sources ?? [],
      ...(p.unitEcon ? { unitEcon: p.unitEcon } : {}),
      ...(p.subScores ? { subScores: p.subScores } : {}),
      ...(p.score !== undefined ? { score: p.score } : {}),
      ...(p.grade ? { grade: p.grade } : {}),
      ...(p.decision ? { decision: p.decision } : {}),
      competitorIds: [], tags: [], createdBy: actorId, updatedBy: actorId,
    });
    return doc._id.toString();
  }

  async get(id: string): Promise<ProductView> {
    const doc = await this.model.findOne({ _id: id, active: { $ne: false } }).exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  async update(id: string, actorId: string, dto: UpdateProductDto): Promise<ProductView> {
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

    const doc = await this.model
      .findOneAndUpdate({ _id: id, active: { $ne: false } }, { $set: set }, { returnDocument: 'after' })
      .exec();
    if (!doc) throw new NotFoundException('Product not found.');
    return this.toView(doc);
  }

  async remove(id: string, actorId: string): Promise<void> {
    await this.model
      .findOneAndUpdate({ _id: id, active: { $ne: false } }, { $set: { active: false, updatedBy: actorId } })
      .exec();
  }

  private async toView(doc: ProductDocument): Promise<ProductView> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toProductView(doc, refs);
  }

  private async toViews(docs: ProductDocument[]): Promise<ProductView[]> {
    const refs = await this.users.refMap(docs.flatMap((d) => [d.createdBy, d.updatedBy]));
    return docs.map((d) => toProductView(d, refs));
  }
}
