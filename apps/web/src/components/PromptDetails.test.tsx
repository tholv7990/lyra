import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { PromptStatus, PromptType, Provider, type Prompt } from '@lyra/shared';
import { PromptDetails } from './PromptDetails';

const prompt: Prompt = {
  id: 'prompt-1',
  workspaceId: 'workspace-1',
  title: 'Competitor analysis',
  content: 'Full prompt body that should be editable',
  status: PromptStatus.Public,
  type: PromptType.Image,
  tags: [],
  media: [],
  provider: Provider.Anthropic,
  model: 'claude-sonnet-4',
  active: true,
  createdAt: '2026-06-17T00:00:00.000Z',
  updatedAt: '2026-06-17T00:00:00.000Z',
  createdBy: { id: 'user-1', name: 'Putiin' },
  updatedBy: { id: 'user-1', name: 'Putiin' },
};

describe('PromptDetails', () => {
  test('renders an editable prompt body when editing is allowed', () => {
    const html = renderToStaticMarkup(
      <PromptDetails
        prompt={prompt}
        labels={[]}
        canEdit
        onSaveContent={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('textarea');
    expect(html).toContain('Full prompt body that should be editable');
    expect(html).toContain('Save changes');
    expect(html).toContain('disabled=""');
    expect(html).toContain('pd-save-icon');
    expect(html).not.toContain('class="btn-primary pd-save"');
    // The type badge mirrors the marketplace `.mkt-type` pill.
    expect(html).toContain('badge mkt-type');
  });
});
