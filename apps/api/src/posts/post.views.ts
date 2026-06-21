import type { PublishedPost as PublishedPostView, Receipt, UserRef } from '@lyra/shared';
import type { PublishedPostDocument } from './post.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

export function toPostView(d: PublishedPostDocument, refs: Map<string, UserRef>): PublishedPostView {
  return {
    id: d._id.toString(),
    workspaceId: d.workspaceId,
    projectId: d.projectId,
    caption: d.caption ?? '',
    mediaUrls: d.mediaUrls ?? [],
    channelIds: d.channelIds ?? [],
    targets: (d.targets ?? []).map(
      (tg): Receipt => ({
        platform: tg.platform,
        accountId: tg.accountId,
        url: tg.url,
        postId: tg.postId,
        status: tg.status as Receipt['status'],
        error: tg.error,
      }),
    ),
    status: d.status as PublishedPostView['status'],
    createdBy: userRef(d.createdBy, refs),
    createdAt: iso(d.createdAt),
  };
}
