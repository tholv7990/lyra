import { useState } from 'react';
import { api } from './api';
import { ImageOp, RunStatus, StepStatus, type Run } from '@lyra/shared';

export function previewRunProgress(run: Run, stepIndex = run.currentStep): Run {
  return {
    ...run,
    status: RunStatus.Running,
    currentStep: stepIndex,
    steps: run.steps.map((step) =>
      step.index === stepIndex && step.status === StepStatus.Idle
        ? { ...step, status: StepStatus.Running }
        : step,
    ),
  };
}

// Run-step actions shared by the run views (project workbench + builder run mode).
// Each endpoint returns the updated Run synchronously, so the caller just stores it.
export function useRunActions(run: Run | null, setRun: (r: Run) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<Run>, preview?: Run) {
    setBusy(true);
    setError(null);
    const before = run;
    if (preview) setRun(preview);
    try {
      setRun(await fn());
    } catch (e) {
      if (before) setRun(before);
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const post = (path: string, body?: unknown) =>
    api<Run>(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });

  return {
    busy,
    error,
    runAll: () => { if (run) void act(() => post(`/runs/${run.id}/run-all`), previewRunProgress(run)); },
    stop: () => { if (run) void act(() => post(`/runs/${run.id}/stop`)); },
    reset: () => { if (run) void act(() => post(`/runs/${run.id}/reset`)); },
    runStep: (i: number, bypassCache?: boolean) => {
      if (run) void act(() => post(`/runs/${run.id}/steps/${i}/run`, bypassCache ? { bypassCache: true } : undefined), previewRunProgress(run, i));
    },
    regenerate: (i: number) => {
      if (run) void act(() => post(`/runs/${run.id}/steps/${i}/run`, { bypassCache: true }), previewRunProgress(run, i));
    },
    approve: (i: number) => { if (run) void act(() => post(`/runs/${run.id}/steps/${i}/approve`)); },
    savePrompt: (i: number, prompt: string) => {
      if (run) void act(() => api<Run>(`/runs/${run.id}/steps/${i}/prompt`, { method: 'PATCH', body: JSON.stringify({ prompt }) }));
    },
    imageAction: (sourceStepIndex: number, assetId: string, op: ImageOp) => {
      if (run) void act(() => post(`/runs/${run.id}/actions/image`, { sourceStepIndex, assetId, op }));
    },
  };
}
