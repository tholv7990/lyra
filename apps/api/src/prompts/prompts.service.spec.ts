import { PromptStatus, PromptType, Provider } from '@lyra/shared';
import { buildPromptListFilter } from './prompts.service';
import { toPrompt } from './prompt.views';
import type { PromptDocument } from './prompt.schema';

describe('buildPromptListFilter', () => {
  it('matches any selected tag case-insensitively', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: ['Check', 'first', 'testing'],
      types: [],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.tags).toEqual({
      $in: [/^Check$/i, /^first$/i, /^testing$/i],
    });
  });

  it('matches any selected type case-insensitively (mirrors tags)', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: [],
      types: [PromptType.Image, PromptType.Video],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.type).toEqual({ $in: [/^image$/i, /^video$/i] });
  });

  it('omits the type filter when no types are selected', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: [],
      types: [],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.type).toBeUndefined();
  });

  it('keeps multi-select groups as OR within group and AND between groups', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [PromptStatus.Public, PromptStatus.Draft],
      tags: ['Check'],
      types: [PromptType.Image],
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
    expect(filter.type).toEqual({ $in: [/^image$/i] });
  });
});

describe('toPrompt type mapping', () => {
  function doc(over: Partial<PromptDocument> = {}): PromptDocument {
    return {
      _id: { toString: () => 'p1' },
      workspaceId: 'ws-1',
      title: 'T',
      content: 'C',
      status: PromptStatus.Draft,
      media: [],
      tags: [],
      active: true,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...over,
    } as unknown as PromptDocument;
  }

  it('defaults legacy docs with no type to Text', () => {
    const view = toPrompt(doc({ type: undefined } as never), new Map());
    expect(view.type).toBe(PromptType.Text);
  });

  it('passes through a stored type', () => {
    const view = toPrompt(doc({ type: PromptType.Video } as never), new Map());
    expect(view.type).toBe(PromptType.Video);
  });
});
