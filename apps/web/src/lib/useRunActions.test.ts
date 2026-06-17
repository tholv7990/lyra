import { describe, expect, test } from 'vitest';
import { Provider, RunStatus, StepMode, StepStatus, type Run } from '@lyra/shared';
import { previewRunProgress } from './useRunActions';

function idleRun(): Run {
  return {
    id: 'run-1',
    workspaceId: 'workspace-1',
    status: RunStatus.Idle,
    currentStep: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'Ada' },
    updatedBy: { id: 'user-1', name: 'Ada' },
    steps: [
      {
        index: 0,
        name: 'Brief',
        provider: Provider.Anthropic,
        mode: StepMode.Auto,
        status: StepStatus.Idle,
        model: 'claude-sonnet-4',
        prompt: 'Write a brief',
      },
    ],
  };
}

describe('previewRunProgress', () => {
  test('marks the current idle step as running while the API request is pending', () => {
    const preview = previewRunProgress(idleRun());

    expect(preview.status).toBe(RunStatus.Running);
    expect(preview.steps[0].status).toBe(StepStatus.Running);
  });
});
