import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RunStepCard } from './RunStepCard';
import { StepKey, StepMode, StepStatus, type Step, type Asset } from '@lyra/shared';

// RunStepCard children may read window.matchMedia at render; stub like RunFlow.test.
vi.stubGlobal('window', {
  matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
});

const imgStep: Step = { index: 0, name: 'Hero', mode: StepMode.Auto, status: StepStatus.Done, model: 'gemini-2.5-flash-image', prompt: 'x' };
const imgAsset = { id: 'A', type: 'image', url: 'https://x/i.png', stepIndex: 0 } as Asset;

function renderWithRouter(props: Partial<React.ComponentProps<typeof RunStepCard>> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RunStepCard
        step={imgStep} input="" inputLabel="" locked={false} isCurrent={false} busy={false}
        onRun={() => {}} onApprove={() => {}} onSavePrompt={() => {}} runId="r1"
        assets={[imgAsset]} onImageAction={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

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

  it('renders the Regenerate button for a completed step when onRegenerate is provided', () => {
    const onRegenerate = vi.fn();
    const props = {
      step: {
        index: 0,
        key: StepKey.Find,
        mode: StepMode.Auto,
        status: StepStatus.Done,
        prompt: 'Test prompt',
        name: 'Test Step',
        model: 'claude-3-sonnet',
        result: 'Some result',
      },
      input: '',
      inputLabel: 'Input',
      locked: false,
      isCurrent: false,
      busy: false,
      onRun: () => {},
      onApprove: () => {},
      onSavePrompt: () => {},
      onRegenerate,
      runId: 'run-456',
    };

    const html = renderToStaticMarkup(<RunStepCard {...props} />);
    expect(html).toContain('Regenerate');
  });

  it('does NOT render the Regenerate button when onRegenerate is omitted', () => {
    const props = {
      step: {
        index: 0,
        key: StepKey.Find,
        mode: StepMode.Auto,
        status: StepStatus.Done,
        prompt: 'Test prompt',
        name: 'Test Step',
        model: 'claude-3-sonnet',
        result: 'Some result',
      },
      input: '',
      inputLabel: 'Input',
      locked: false,
      isCurrent: false,
      busy: false,
      onRun: () => {},
      onApprove: () => {},
      onSavePrompt: () => {},
      runId: 'run-789',
    };

    const html = renderToStaticMarkup(<RunStepCard {...props} />);
    expect(html).not.toContain('Regenerate');
  });

  it('does NOT render the Regenerate button for a locked step', () => {
    const props = {
      step: {
        index: 0,
        key: StepKey.Find,
        mode: StepMode.Auto,
        status: StepStatus.Done,
        prompt: 'Test prompt',
        name: 'Test Step',
        model: 'claude-3-sonnet',
        result: 'Some result',
      },
      input: '',
      inputLabel: 'Input',
      locked: true,
      isCurrent: false,
      busy: false,
      onRun: () => {},
      onApprove: () => {},
      onSavePrompt: () => {},
      onRegenerate: vi.fn(),
      runId: 'run-locked',
    };

    const html = renderToStaticMarkup(<RunStepCard {...props} />);
    expect(html).not.toContain('Regenerate');
  });
});

describe('RunStepCard image actions', () => {
  it('renders the action bar on a done image asset when onImageAction is set', () => {
    const html = renderWithRouter();
    expect(html).toContain('Upscale');
    expect(html).toContain('Variation');
    expect(html).toContain('Outpaint');
  });

  it('omits the action bar when onImageAction is not provided', () => {
    const html = renderWithRouter({ onImageAction: undefined });
    expect(html).not.toContain('Upscale');
  });
});

describe('RunStepCard StepEditModal affordance', () => {
  // The card auto-expands when isCurrent=true, which is how we see the body.
  const currentStep: Step = {
    index: 0,
    name: 'Brief',
    mode: StepMode.Auto,
    status: StepStatus.Idle,
    model: 'claude-sonnet-4',
    prompt: 'Write a brief',
  };

  it('shows an Edit button (not an inline textarea) when wsId is provided', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RunStepCard
          step={currentStep}
          input="" inputLabel="" locked={false} isCurrent={true} busy={false}
          onRun={() => {}} onApprove={() => {}} onSavePrompt={() => {}} runId="r1"
          wsId="ws-1"
        />
      </MemoryRouter>,
    );
    // The Composer modal edit affordance must be present (rendered as translated text)…
    expect(html).toContain('Edit prompt');
    // …and the inline textarea must be gone.
    expect(html).not.toContain('<textarea');
  });

  it('shows no Edit button and no inline textarea when wsId is omitted', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RunStepCard
          step={currentStep}
          input="" inputLabel="" locked={false} isCurrent={true} busy={false}
          onRun={() => {}} onApprove={() => {}} onSavePrompt={() => {}} runId="r1"
        />
      </MemoryRouter>,
    );
    expect(html).not.toContain('Edit prompt');
    expect(html).not.toContain('<textarea');
  });
});
