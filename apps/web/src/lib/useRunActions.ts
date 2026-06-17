import { useState } from 'react';
import { api } from './api';
import type { Run } from '@lyra/shared';

// Run-step actions shared by the run views (project workbench + builder run mode).
// Each endpoint returns the updated Run synchronously, so the caller just stores it.
export function useRunActions(run: Run | null, setRun: (r: Run) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<Run>) {
    setBusy(true);
    setError(null);
    try {
      setRun(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const post = (path: string) => api<Run>(path, { method: 'POST' });

  return {
    busy,
    error,
    runAll: () => { if (run) void act(() => post(`/runs/${run.id}/run-all`)); },
    stop: () => { if (run) void act(() => post(`/runs/${run.id}/stop`)); },
    reset: () => { if (run) void act(() => post(`/runs/${run.id}/reset`)); },
    runStep: (i: number) => { if (run) void act(() => post(`/runs/${run.id}/steps/${i}/run`)); },
    approve: (i: number) => { if (run) void act(() => post(`/runs/${run.id}/steps/${i}/approve`)); },
    savePrompt: (i: number, prompt: string) => {
      if (run) void act(() => api<Run>(`/runs/${run.id}/steps/${i}/prompt`, { method: 'PATCH', body: JSON.stringify({ prompt }) }));
    },
  };
}
