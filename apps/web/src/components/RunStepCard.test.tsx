import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { RunStepCard } from './RunStepCard';
import { StepKey, StepMode, StepStatus } from '@lyra/shared';

describe('RunStepCard', () => {
  it('shows the cached badge only when step.cached is true', () => {
    const baseProps = {
      step: {
        index: 0,
        key: StepKey.Find,
        mode: StepMode.Auto,
        status: StepStatus.Done,
        prompt: 'Test prompt',
        name: 'Test Step',
        model: 'claude-3-sonnet',
        result: 'Test result',
        cached: true,
      },
      input: 'Test input',
      inputLabel: 'Input',
      locked: false,
      isCurrent: false,
      busy: false,
      onRun: () => {},
      onApprove: () => {},
      onSavePrompt: () => {},
      runId: 'run-123',
    };

    // Render with cached: true
    const cachedHtml = renderToStaticMarkup(
      <RunStepCard {...baseProps} />
    );

    // Render with cached: false
    const freshHtml = renderToStaticMarkup(
      <RunStepCard {...baseProps} step={{ ...baseProps.step, cached: false }} />
    );

    expect(cachedHtml).toContain('badge-cached');
    expect(cachedHtml).toContain('Cached');
    expect(freshHtml).not.toContain('badge-cached');
  });
});
