import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Asset as AssetModel } from '@lyra/shared';
import { Asset } from './asset.schema';
import type { AssetDocument } from './asset.schema';
import type { StepAssetOutput } from '../runs/providers/step-provider.interface';
import { BaseRepository } from '../common/database/base.repository';
import { toAsset } from './asset.views';

@Injectable()
export class AssetsService extends BaseRepository<Asset> {
  constructor(@InjectModel(Asset.name) model: Model<Asset>) {
    super(model);
  }

  // Persist the assets a step produced; returns the created ids (for the step's
  // `assetIds`). One Asset doc per output, scoped to the run's workspace.
  async createForStep(
    params: { workspaceId: string; runId: string; stepIndex: number; actorId: string },
    outputs: StepAssetOutput[],
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const o of outputs) {
      const doc = await this.create({
        workspaceId: params.workspaceId,
        runId: params.runId,
        stepIndex: params.stepIndex,
        type: o.type,
        url: o.url,
        thumbUrl: o.thumbUrl,
        meta: o.meta,
        approved: false,
        createdBy: params.actorId,
        updatedBy: params.actorId,
      });
      ids.push(doc._id.toString());
    }
    return ids;
  }

  listForRun(runId: string): Promise<AssetDocument[]> {
    return this.find({ runId }, { sort: { stepIndex: 1, createdAt: 1 } });
  }

  toViews(docs: AssetDocument[]): AssetModel[] {
    return docs.map(toAsset);
  }
}
