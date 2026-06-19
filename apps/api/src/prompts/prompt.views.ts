import { PromptType } from '@lyra/shared';
import type {
  Prompt as PromptModel,
  PromptMedia,
  Provider,
  SavedResult,
  UserRef,
} from '@lyra/shared';
import type { PromptDocument, PromptResultItem } from './prompt.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

// Subdocs carry an _id at runtime that the class type doesn't declare.
type ResultDoc = PromptResultItem & { _id: { toString(): string } };

export function toPrompt(
  p: PromptDocument,
  refs: Map<string, UserRef>,
): PromptModel {
  return {
    id: p._id.toString(),
    workspaceId: p.workspaceId,
    title: p.title,
    content: p.content,
    status: p.status,
    // Legacy docs created before `type` existed have none — default to Text so
    // responses always carry a valid type.
    type: p.type ?? PromptType.Text,
    media: (p.media ?? []).map(
      (m): PromptMedia => ({
        type: m.type,
        url: m.url,
        name: m.name,
        mime: m.mime,
        size: m.size,
      }),
    ),
    tags: p.tags ?? [],
    provider: p.provider as Provider | undefined,
    model: p.model,
    results: ((p.results ?? []) as ResultDoc[]).map(
      (r): SavedResult => ({
        id: r._id.toString(),
        output: r.output,
        provider: r.provider as Provider,
        model: r.model,
        promptSnapshot: r.promptSnapshot ?? '',
        rating: r.rating,
        note: r.note,
        sourceConversationId: r.sourceConversationId,
        createdBy: userRef(r.createdBy, refs),
        savedAt: iso(r.savedAt),
      }),
    ),
    active: p.active ?? true,
    createdBy: userRef(p.createdBy, refs),
    updatedBy: userRef(p.updatedBy, refs),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt ?? p.createdAt),
  };
}

// Collect every user id a prompt references (for batch resolution) — the
// prompt's own actors plus every saved-result author.
export function promptActorIds(p: PromptDocument): string[] {
  return [p.createdBy, p.updatedBy, ...(p.results ?? []).map((r) => r.createdBy)];
}
