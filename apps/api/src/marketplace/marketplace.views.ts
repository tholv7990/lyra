import type { MarketplacePrompt as MarketplacePromptModel } from '@lyra/shared';
import type { MarketplacePromptDocument } from './marketplace.schema';
import { iso } from '../common/dates';

// Map a catalog document to the shared safe transport shape (id = _id string,
// ISO dates). The catalog holds no server-only fields, so this is total.
export function toMarketplacePrompt(
  p: MarketplacePromptDocument,
): MarketplacePromptModel {
  return {
    id: p._id.toString(),
    title: p.title,
    description: p.description || undefined,
    content: p.content,
    type: p.type,
    forDevs: p.forDevs ?? false,
    contributor: p.contributor,
    source: p.source,
    category: p.category || undefined,
    variables: p.variables ?? [],
    tags: p.tags ?? [],
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt ?? p.createdAt),
  };
}
