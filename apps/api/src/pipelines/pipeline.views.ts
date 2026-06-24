import { type ActionStep, type Pipeline as PipelineModel, type PipelineOrigin, type PipelineStep, type PipelineVariable, type StepCondition, type UserRef } from '@lyra/shared';
import type { PipelineDocument } from './pipeline.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

export function toPipeline(
  p: PipelineDocument,
  refs: Map<string, UserRef>,
): PipelineModel {
  return {
    id: p._id.toString(),
    workspaceId: p.workspaceId,
    name: p.name,
    description: p.description,
    tags: p.tags ?? [],
    steps: (p.steps ?? []).map(
      (s): PipelineStep => ({
        id: s.id,
        name: s.name,
        promptId: s.promptId,
        promptOverride: s.promptOverride,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        fanOut: s.fanOut ? { over: s.fanOut.over, itemVar: s.fanOut.itemVar } : undefined,
        condition: s.condition
          ? {
              variable: s.condition.variable,
              op: s.condition.op as StepCondition['op'],
              value: s.condition.value,
            }
          : undefined,
        kind: s.kind as PipelineStep['kind'],
        action: s.action as PipelineStep['action'],
        review: s.review,
      }),
    ),
    variables: (p.variables ?? []).map(
      (v): PipelineVariable => ({ key: v.key, label: v.label, default: v.default }),
    ),
    origin: p.origin
      ? ({
          source: p.origin.source === 'ai' ? 'ai' : 'manual',
          goal: p.origin.goal,
          model: p.origin.model,
        } as PipelineOrigin)
      : undefined,
    active: p.active ?? true,
    createdBy: userRef(p.createdBy, refs),
    updatedBy: userRef(p.updatedBy, refs),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt ?? p.createdAt),
  };
}

export function pipelineActorIds(p: PipelineDocument): string[] {
  return [p.createdBy, p.updatedBy];
}
