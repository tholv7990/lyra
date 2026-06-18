import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { Provider, RunStatus, StepMode, StepStatus, type Run } from '@lyra/shared';
import { RunFlow } from './RunFlow';

const matchMedia = (matches: boolean) =>
  vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

function run(): Run {
  return {
    id: 'run-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    pipelineId: 'pipeline-1',
    pipelineName: 'GainsSteel launch',
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
        promptId: 'prompt-1',
        provider: Provider.Anthropic,
        mode: StepMode.Auto,
        status: StepStatus.Idle,
        model: 'claude-sonnet-4',
        prompt: 'Write a launch brief',
      },
    ],
  };
}

describe('RunFlow', () => {
  test('can render the complete mobile flow instead of the one-page pager', () => {
    vi.stubGlobal('window', { matchMedia: matchMedia(true) });

    const html = renderToStaticMarkup(
      <RunFlow
        run={run()}
        busy={false}
        hasKey={() => true}
        onRunStep={() => undefined}
        onApprove={() => undefined}
        onSavePrompt={() => undefined}
        mobileLayout="flow"
      />,
    );

    expect(html).toContain('Start');
    expect(html).toContain('Brief');
    expect(html).toContain('Run');
    expect(html).toContain('End');
    expect(html).not.toContain('flow-pager-bar');
  });

  test('exposes a finished step result behind "View result", not inlined with the prompt', () => {
    vi.stubGlobal('window', { matchMedia: matchMedia(true) });
    const doneRun = run();
    doneRun.status = RunStatus.Done;
    doneRun.steps[0].status = StepStatus.Done;
    doneRun.steps[0].result = 'BRIEF-OUTPUT-TEXT';

    const html = renderToStaticMarkup(
      <RunFlow
        run={doneRun}
        busy={false}
        hasKey={() => true}
        onRunStep={() => undefined}
        onApprove={() => undefined}
        onSavePrompt={() => undefined}
        mobileLayout="flow"
      />,
    );

    // The result is a first-class action, decoupled from the prompt editor…
    expect(html).toContain('View result');
    // …and is no longer pinned inline — it opens in the modal on click.
    expect(html).not.toContain('rn-result-pin');
    expect(html).not.toContain('BRIEF-OUTPUT-TEXT');
  });
});
