import type {
  Run as RunModel,
  Step,
  RunStatus,
  StepStatus,
  StepCondition,
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
    pipelineStepId: s.pipelineStepId,
    provider: s.provider as Step['provider'],
    mode: s.mode as StepMode,
    status: s.status as StepStatus,
    model: s.model,
    prompt: s.prompt,
    sentPrompt: s.sentPrompt,
    fanOut: s.fanOut ? { over: s.fanOut.over, itemVar: s.fanOut.itemVar } : undefined,
    condition: s.condition
      ? {
          variable: s.condition.variable,
          op: s.condition.op as StepCondition['op'],
          value: s.condition.value,
        }
      : undefined,
    result: s.result,
    assetIds: s.assetIds,
    inputAssetIds: s.inputAssetIds,
    usage: s.usage,
    error: s.error,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    cached: s.cached,
    // async (video) job fields must survive the doc<->state round-trip: persist
    // assigns state.steps wholesale, so dropping these here would wipe an in-flight
    // jobId on the next progress update (poller would lose the job).
    jobId: s.jobId,
    progress: s.progress,
    // kind/action must survive reload so an action step (incl. the research CODE
    // actions) is dispatched correctly in the gated step-by-step flow; the
    // structured ledger fields must survive so prior steps feed the RunLedger.
    kind: s.kind as Step['kind'],
    action: s.action as Step['action'],
    evidence: s.evidence as Step['evidence'],
    sources: s.sources as Step['sources'],
    data: s.data,
    // post-render QA fields must round-trip (persist assigns state.steps wholesale).
    review: s.review,
    reviewIssues: s.reviewIssues,
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
    collections: doc.collections,
    status: doc.status as RunStatus,
    currentStep: doc.currentStep,
    steps: doc.steps.map(toStep),
    rating: doc.rating
      ? { value: doc.rating.value as 'up' | 'down', by: doc.rating.by, at: doc.rating.at }
      : undefined,
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
