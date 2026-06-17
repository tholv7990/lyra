import type {
  Run as RunModel,
  Step,
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
  UserRef,
} from '@lyra/shared';
import type { RunDocument, RunStep } from './run.schema';
import type { RunState } from './run.engine';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

function toStep(s: RunStep): Step {
  return {
    index: s.index,
    key: s.key as StepKey | undefined,
    name: s.name,
    promptId: s.promptId,
    provider: s.provider as Step['provider'],
    mode: s.mode as StepMode,
    status: s.status as StepStatus,
    model: s.model,
    prompt: s.prompt,
    result: s.result,
    assetIds: s.assetIds,
    usage: s.usage,
    error: s.error,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
  };
}

export function toRun(doc: RunDocument, refs: Map<string, UserRef>): RunModel {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId,
    workspaceId: doc.workspaceId,
    pipelineId: doc.pipelineId,
    pipelineName: doc.pipelineName,
    context: doc.context,
    variables: doc.variables,
    status: doc.status as RunStatus,
    currentStep: doc.currentStep,
    steps: doc.steps.map(toStep),
    active: doc.active ?? true,
    createdBy: userRef(doc.createdBy, refs),
    updatedBy: userRef(doc.updatedBy, refs),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt ?? doc.createdAt),
  };
}

// Plain state for the pure engine (shared Step shape).
export function toState(doc: RunDocument): RunState {
  return {
    status: doc.status as RunStatus,
    currentStep: doc.currentStep,
    steps: doc.steps.map(toStep),
  };
}
