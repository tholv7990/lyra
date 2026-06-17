import { PromptStatus, Provider } from '@lyra/shared';
import { buildPromptListFilter } from './prompts.service';

describe('buildPromptListFilter', () => {
  it('matches any selected tag case-insensitively', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: ['Check', 'first', 'testing'],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.tags).toEqual({
      $in: [/^Check$/i, /^first$/i, /^testing$/i],
    });
  });

  it('keeps multi-select groups as OR within group and AND between groups', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [PromptStatus.Public, PromptStatus.Draft],
      tags: ['Check'],
      createdBy: ['user-1', 'user-2'],
      providers: [Provider.Anthropic, Provider.DeepSeek],
      q: 'cozy',
    });

    expect(filter).toMatchObject({
      workspaceId: 'workspace-1',
      status: { $in: [PromptStatus.Public, PromptStatus.Draft] },
      createdBy: { $in: ['user-1', 'user-2'] },
      provider: { $in: [Provider.Anthropic, Provider.DeepSeek] },
      title: { $regex: 'cozy', $options: 'i' },
    });
    expect(filter.tags).toEqual({ $in: [/^Check$/i] });
  });
});
