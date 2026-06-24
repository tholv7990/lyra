/**
 * Unit tests for StepEditModal.
 *
 * Uses renderToStaticMarkup (node env, no RTL/jsdom) — same pattern as
 * RememberModal.test.tsx and Composer.test.tsx in this project.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MediaType, Provider, type PromptMedia } from '@lyra/shared';

// Stub i18n — return the key so assertions match key names.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Stub api — never actually called during static render.
vi.mock('../lib/api', () => ({
  api: vi.fn().mockResolvedValue({}),
}));

// Stub Modal hooks that access browser APIs absent in node.
vi.mock('../lib/useEscapeKey', () => ({ useEscapeKey: () => undefined }));
vi.mock('../lib/useScrollLock', () => ({ useScrollLock: () => undefined }));
vi.mock('../lib/useViewportVars', () => ({ useViewportVars: () => undefined }));

// Stub ModelPicker's outside-click ref hook.
vi.mock('../lib/useOutsideClick', () => ({ useOutsideClick: () => undefined }));

// Stub useAutoResize (accesses textarea DOM ref).
vi.mock('../lib/useAutoResize', () => ({ useAutoResize: () => undefined }));

import { StepEditModal } from './StepEditModal';

const noop = () => Promise.resolve();

const baseProps = {
  wsId: 'ws-1',
  stepIndex: 0,
  prompt: 'Write a product brief for {product}',
  media: [] as PromptMedia[],
  provider: Provider.Anthropic,
  model: 'claude-sonnet-4-5',
  onClose: () => undefined,
  onSavePrompt: noop,
  onSaveModel: noop,
  onSaveMedia: noop,
};

const sampleMedia: PromptMedia[] = [
  {
    type: MediaType.File,
    url: 'https://example.com/files/abc123',
    name: 'brief.pdf',
    mime: 'application/pdf',
    size: 12345,
  },
];

describe('StepEditModal', () => {
  it('renders the modal title using the i18n key', () => {
    const html = renderToStaticMarkup(<StepEditModal {...baseProps} />);
    expect(html).toContain('run.editStep');
  });

  it('renders the Composer textarea with the step prompt', () => {
    const html = renderToStaticMarkup(<StepEditModal {...baseProps} />);
    expect(html).toContain('composer-input');
    expect(html).toContain('Write a product brief for {product}');
  });

  it('renders the model chip (ModelPicker) inside the Composer', () => {
    const html = renderToStaticMarkup(<StepEditModal {...baseProps} />);
    expect(html).toContain('model-pill');
  });

  it('renders Save & re-run and Cancel action buttons', () => {
    const html = renderToStaticMarkup(<StepEditModal {...baseProps} />);
    expect(html).toContain('run.saveAndRerun');
    expect(html).toContain('common.cancel');
  });

  it('does NOT render Save to pipeline when canPromote is false', () => {
    const html = renderToStaticMarkup(<StepEditModal {...baseProps} canPromote={false} />);
    expect(html).not.toContain('run.saveToPipeline');
  });

  it('renders Save to pipeline when canPromote is true and onSaveToPipeline is provided', () => {
    const html = renderToStaticMarkup(
      <StepEditModal {...baseProps} canPromote onSaveToPipeline={noop} />,
    );
    expect(html).toContain('run.saveToPipeline');
  });

  it('renders an attachment chip when media is supplied', () => {
    const html = renderToStaticMarkup(
      <StepEditModal {...baseProps} media={sampleMedia} />,
    );
    // AttachmentPreviews renders the file name inside the chip
    expect(html).toContain('brief.pdf');
  });

  it('renders no attachment chips when media is empty', () => {
    const html = renderToStaticMarkup(<StepEditModal {...baseProps} media={[]} />);
    expect(html).not.toContain('att-chip');
    expect(html).not.toContain('att-thumb');
  });
});
