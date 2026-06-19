import { PromptCategory, PromptStatus, PromptType, Provider } from '@lyra/shared';
import { buildPromptListFilter } from './prompts.service';
import { toPrompt } from './prompt.views';
import type { PromptDocument } from './prompt.schema';

describe('buildPromptListFilter', () => {
  it('matches any selected tag case-insensitively', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: ['Check', 'first', 'testing'],
      types: [],
      categories: [],
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
      categories: [],
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
      categories: [],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.type).toBeUndefined();
  });

  it('matches any selected category case-insensitively (mirrors type)', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: [],
      types: [],
      categories: [PromptCategory.Coding, PromptCategory.BusinessStrategy],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.category).toEqual({
      $in: [/^Coding$/i, /^Business Strategy$/i],
    });
  });

  it('omits the category filter when no categories are selected', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [],
      tags: [],
      types: [],
      categories: [],
      createdBy: [],
      providers: [],
      q: '',
    });

    expect(filter.category).toBeUndefined();
  });

  it('keeps multi-select groups as OR within group and AND between groups', () => {
    const filter = buildPromptListFilter('workspace-1', 'user-1', {
      statuses: [PromptStatus.Public, PromptStatus.Draft],
      tags: ['Check'],
      types: [PromptType.Image],
      categories: [PromptCategory.Creative],
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
    expect(filter.category).toEqual({ $in: [/^Creative$/i] });
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

  it('leaves category undefined when unset (no invented default)', () => {
    const view = toPrompt(doc({ category: undefined } as never), new Map());
    expect(view.category).toBeUndefined();
  });

  it('passes through a stored category', () => {
    const view = toPrompt(
      doc({ category: PromptCategory.Writing } as never),
      new Map(),
    );
    expect(view.category).toBe(PromptCategory.Writing);
  });
});
