import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Provider, PromptStatus, StepMode, type PipelineStep, type Prompt } from '@lyra/shared';
import { FlowCallbacksProvider } from './flow/flowCallbacks';
import { StepCard } from './StepCard';

const step: PipelineStep = {
  id: 'step-1',
  name: 'Find stores',
  promptId: 'prompt-1',
  provider: Provider.Anthropic,
  model: 'claude-sonnet-4',
  mode: StepMode.Auto,
};

const prompt: Prompt = {
  id: 'prompt-1',
  workspaceId: 'workspace-1',
  title: 'Find stores',
  content: 'Find 10 stores that sell pet toys',
  status: PromptStatus.Public,
  media: [],
  tags: [],
  active: true,
  createdBy: { id: 'user-1', name: 'Ada' },
  updatedBy: { id: 'user-1', name: 'Ada' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('StepCard', () => {
  test('shows a Test action for pipeline nodes when testing is available', () => {
    const html = renderToStaticMarkup(
      <FlowCallbacksProvider value={{ busy: false, onTestStep: () => undefined }}>
        <StepCard
          step={step}
          index={0}
          canEdit
          prompt={prompt}
          labels={[]}
          modelLabel={() => 'Claude Sonnet 4'}
        />
      </FlowCallbacksProvider>,
    );

    expect(html).toContain('Test');
    expect(html).toContain('Claude Sonnet 4');
    expect(html).not.toContain('Anthropic ·');
  });
});
