import { PromptType } from '@lyra/shared';
import type {
  Prompt as PromptModel,
  PromptMedia,
  Provider,
  UserRef,
} from '@lyra/shared';
import type { PromptDocument } from './prompt.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

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
    // Optional metadata. Legacy/unset docs → undefined; don't invent a default.
    category: p.category ?? undefined,
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
    active: p.active ?? true,
    createdBy: userRef(p.createdBy, refs),
    updatedBy: userRef(p.updatedBy, refs),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt ?? p.createdAt),
  };
}

// Collect every user id a prompt references (for batch resolution).
export function promptActorIds(p: PromptDocument): string[] {
  return [p.createdBy, p.updatedBy];
}
