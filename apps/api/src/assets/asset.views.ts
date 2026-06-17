import type { Asset as AssetModel } from '@lyra/shared';
import type { AssetDocument } from './asset.schema';

// Map a stored Asset document to the shared transport shape. Audit/active fields
// stay server-side.
export function toAsset(a: AssetDocument): AssetModel {
  return {
    id: a._id.toString(),
    runId: a.runId,
    workspaceId: a.workspaceId,
    stepIndex: a.stepIndex,
    type: a.type,
    url: a.url,
    thumbUrl: a.thumbUrl,
    meta: a.meta,
    approved: a.approved ?? false,
  };
}
