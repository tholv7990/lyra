import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { normalizeTag, tagKey, type LabelInfo } from '@lyra/shared';
import { Label, LabelDocument } from './label.schema';

@Injectable()
export class LabelsService {
  constructor(
    @InjectModel(Label.name) private readonly model: Model<Label>,
  ) {}

  // All labels in the workspace, alphabetical, for the picker.
  async list(workspaceId: string): Promise<LabelInfo[]> {
    const docs = await this.model
      .find({ workspaceId, active: { $ne: false } })
      .sort({ nameKey: 1 })
      .exec();
    return docs.map((d) => this.toView(d));
  }

  // Create (or, idempotently, recolour) a label by name. The flow only offers
  // "Create new label" when no match exists, so this normally inserts.
  async create(
    workspaceId: string,
    actorId: string,
    name: string,
    color: string,
  ): Promise<LabelInfo> {
    const clean = normalizeTag(name);
    if (!clean) throw new BadRequestException('Label name is required.');
    const nameKey = tagKey(clean);
    const doc = await this.model
      .findOneAndUpdate(
        { workspaceId, nameKey },
        {
          $set: { name: clean, color, updatedBy: actorId, active: true },
          $setOnInsert: { workspaceId, nameKey, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return this.toView(doc!);
  }

  private toView(d: LabelDocument): LabelInfo {
    return { id: d.id, name: d.name, color: d.color };
  }
}
