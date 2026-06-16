import type { PromptTest as PromptTestModel, UserRef } from '@lyra/shared';
import type { PromptTestDocument } from './prompt-test.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

export function toPromptTest(
  t: PromptTestDocument,
  refs: Map<string, UserRef>,
): PromptTestModel {
  return {
    id: t._id.toString(),
    workspaceId: t.workspaceId,
    promptId: t.promptId,
    provider: t.provider,
    model: t.model,
    input: t.input,
    result: t.result,
    usage: t.usage,
    starred: t.starred ?? false,
    tags: t.tags ?? [],
    error: t.error,
    active: t.active ?? true,
    createdBy: userRef(t.createdBy, refs),
    updatedBy: userRef(t.updatedBy, refs),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt ?? t.createdAt),
  };
}

export function promptTestActorIds(t: PromptTestDocument): string[] {
  return [t.createdBy, t.updatedBy];
}
