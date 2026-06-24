/**
 * Focused unit test for the Composer component rendered with hideSend.
 *
 * NOTE: The step drawer in PipelineBuilder is large and state-heavy (hooks,
 * router, workspace context). Isolating it in a renderToStaticMarkup test
 * requires mocking the entire provider tree, which adds fragile coupling.
 * Instead, we test the Composer component directly -- the same element the
 * drawer mounts -- covering the textarea, model chip, and attachment rendering.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { MediaType, MODEL_CATALOG, Provider, type PromptMedia, type PromptVar } from '@lyra/shared';
import { Composer } from './Composer';

const noop = () => undefined;

const sampleMedia: PromptMedia[] = [
  {
    type: MediaType.File,
    url: 'https://example.com/files/abc123',
    name: 'brief.pdf',
    mime: 'application/pdf',
    size: 12345,
  },
];

describe('Composer (hideSend)', () => {
  it('renders the textarea with the provided value and placeholder', () => {
    const html = renderToStaticMarkup(
      <Composer
        value="Write a product brief for {product}"
        onChange={noop}
        media={[]}
        onFiles={noop}
        onRemoveMedia={noop}
        catalog={MODEL_CATALOG}
        provider={Provider.Anthropic}
        model="claude-sonnet-4-5"
        onModelChange={noop}
        hideSend
        placeholder="Customize this step's prompt..."
      />,
    );

    // Textarea with the supplied value
    expect(html).toContain('composer-input');
    expect(html).toContain('Write a product brief for {product}');
    // renderToStaticMarkup HTML-escapes ' inside attribute values
    expect(html).toContain("Customize this step&#x27;s prompt");

    // Send button must be absent when hideSend is set
    expect(html).not.toContain('send-btn');
  });

  it('renders the model pill from the ModelPicker', () => {
    const html = renderToStaticMarkup(
      <Composer
        value=""
        onChange={noop}
        media={[]}
        onFiles={noop}
        onRemoveMedia={noop}
        catalog={MODEL_CATALOG}
        provider={Provider.Anthropic}
        model="claude-sonnet-4-5"
        onModelChange={noop}
        hideSend
      />,
    );

    // ModelPicker renders a .model-pill button
    expect(html).toContain('model-pill');
  });

  it('renders attachment chips when media is supplied', () => {
    const html = renderToStaticMarkup(
      <Composer
        value=""
        onChange={noop}
        media={sampleMedia}
        onFiles={noop}
        onRemoveMedia={noop}
        catalog={MODEL_CATALOG}
        provider={Provider.Anthropic}
        model="claude-sonnet-4-5"
        onModelChange={noop}
        hideSend
      />,
    );

    // AttachmentPreviews renders each item as .att-chip (non-image) or .att-thumb (image)
    expect(html).toContain('composer-attachments');
    expect(html).toContain('brief.pdf');
  });

  it('renders no attachment chips when media is empty', () => {
    const html = renderToStaticMarkup(
      <Composer
        value=""
        onChange={noop}
        media={[]}
        onFiles={noop}
        onRemoveMedia={noop}
        catalog={MODEL_CATALOG}
        provider={Provider.Anthropic}
        model="claude-sonnet-4-5"
        onModelChange={noop}
        hideSend
      />,
    );

    expect(html).not.toContain('brief.pdf');
    // The attachments wrapper is still rendered by AttachmentPreviews (empty)
    // but no individual chip should appear.
    expect(html).not.toContain('att-chip');
    expect(html).not.toContain('att-thumb');
  });
});

describe('Composer (var chips + dangling warning)', () => {
  const baseProps = {
    onChange: noop,
    media: [] as PromptMedia[],
    onFiles: noop,
    onRemoveMedia: noop,
    catalog: MODEL_CATALOG,
    provider: Provider.Anthropic,
    model: 'claude-sonnet-4-5',
    onModelChange: noop,
    hideSend: true as const,
  };
  const vars: PromptVar[] = [
    { token: '{input}', label: 'Previous step', kind: 'input' },
    { token: '{step:Brief}', label: 'Brief', kind: 'step' },
  ];

  it('renders insertable chips when vars are supplied', () => {
    const html = renderToStaticMarkup(<Composer value="" {...baseProps} vars={vars} />);
    expect(html).toContain('var-chip');
    expect(html).toContain('kind-step');
    expect(html).toContain('Brief');
  });

  it('renders no chip row when vars is empty/omitted', () => {
    const html = renderToStaticMarkup(<Composer value="" {...baseProps} />);
    expect(html).not.toContain('var-chip');
  });

  it('warns about a dangling {step:X} ref', () => {
    const html = renderToStaticMarkup(
      <Composer value="Use {step:Ghost} here" {...baseProps} stepNames={['Brief']} />,
    );
    expect(html).toContain('rn-var-warn');
  });

  it('does not warn when all {step:X} refs are known', () => {
    const html = renderToStaticMarkup(
      <Composer value="Use {step:Brief}" {...baseProps} stepNames={['Brief']} />,
    );
    expect(html).not.toContain('rn-var-warn');
  });
});
