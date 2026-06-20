import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { PromptStatus, PromptType, Provider, type Prompt } from '@lyra/shared';
import { PromptDetails } from './PromptDetails';

// PromptDetails reads the current user for the delete-result affordance.
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Putiin' } }),
}));

const prompt: Prompt = {
  id: 'prompt-1',
  workspaceId: 'workspace-1',
  title: 'Competitor analysis',
  content: 'Full prompt body for {product} in {niche}',
  status: PromptStatus.Public,
  type: PromptType.Image,
  tags: [],
  media: [],
  provider: Provider.Anthropic,
  model: 'claude-sonnet-4',
  results: [],
  active: true,
  createdAt: '2026-06-17T00:00:00.000Z',
  updatedAt: '2026-06-17T00:00:00.000Z',
  createdBy: { id: 'user-1', name: 'Putiin' },
  updatedBy: { id: 'user-1', name: 'Putiin' },
};

describe('PromptDetails', () => {
  test('renders the read view: prompt block, type + status badges, creator, variables', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PromptDetails prompt={prompt} labels={[]} onClose={() => undefined} />
      </MemoryRouter>,
    );

    // Read view shows the prompt in a highlighted code block, not an editable textarea.
    expect(html).toContain('mkd-code');
    expect(html).not.toContain('<textarea');
    // The body is segmented: plain runs + highlighted {variable} spans.
    expect(html).toContain('Full prompt body for');
    expect(html).toContain('mkd-var-hl');
    expect(html).toContain('{product}');
    expect(html).toContain('{niche}');
    // Meta: creator name, type pill, status badge (public).
    expect(html).toContain('Putiin');
    expect(html).toContain('mkt-type-pill');
    expect(html).toContain('badge status-public');
  });
});
