import { ForbiddenException } from '@nestjs/common';
import { PromptStatus, PromptType, Provider } from '@lyra/shared';
import { buildPromptListFilter, PromptsService } from './prompts.service';
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

  it('maps saved results with resolved authors', () => {
    const refs = new Map([['u2', { id: 'u2', name: 'Bob' }]]);
    const view = toPrompt(
      doc({
        results: [
          {
            _id: { toString: () => 'r1' },
            output: 'Hi',
            provider: 'anthropic',
            model: 'claude',
            promptSnapshot: 'snap',
            createdBy: 'u2',
            savedAt: new Date('2026-02-02T00:00:00.000Z'),
          },
        ],
      } as never),
      refs,
    );
    expect(view.results).toHaveLength(1);
    expect(view.results[0]).toMatchObject({
      id: 'r1',
      output: 'Hi',
      createdBy: { id: 'u2', name: 'Bob' },
    });
  });

  it('defaults results to [] when absent', () => {
    expect(toPrompt(doc(), new Map()).results).toEqual([]);
  });
});

describe('PromptsService saved results', () => {
  function service() {
    const users = { refMap: jest.fn(async () => new Map()) };
    const s = new PromptsService({} as never, users as never);
    // toView re-maps the doc; stub it so these tests stay off the model/_id path.
    jest.spyOn(s, 'toView').mockResolvedValue({ id: 'p1' } as never);
    return s;
  }
  function promptDoc(results: unknown[], createdBy = 'owner') {
    return {
      content: 'PROMPT CONTENT',
      createdBy,
      results,
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as PromptDocument;
  }

  it('addResult falls back to the prompt content as the snapshot', async () => {
    const s = service();
    const results: Record<string, unknown>[] = [];
    const prompt = promptDoc(results);
    await s.addResult(prompt, 'u2', {
      output: 'A',
      provider: Provider.Anthropic,
      model: 'claude',
    });
    expect(results).toHaveLength(1);
    expect(results[0].promptSnapshot).toBe('PROMPT CONTENT');
    expect(results[0].createdBy).toBe('u2');
    expect(prompt.save).toHaveBeenCalled();
  });

  it('addResult keeps a supplied snapshot', async () => {
    const s = service();
    const results: Record<string, unknown>[] = [];
    await s.addResult(promptDoc(results), 'u2', {
      output: 'A',
      provider: Provider.Anthropic,
      model: 'claude',
      promptSnapshot: 'EXACT',
    });
    expect(results[0].promptSnapshot).toBe('EXACT');
  });

  it('removeResult forbids a non-author, non-owner', async () => {
    const s = service();
    const prompt = promptDoc(
      [{ _id: { toString: () => 'r1' }, createdBy: 'someone' }],
      'owner',
    );
    await expect(s.removeResult(prompt, 'intruder', 'r1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('removeResult lets the result author remove it', async () => {
    const s = service();
    const results = [{ _id: { toString: () => 'r1' }, createdBy: 'author' }];
    const prompt = promptDoc(results, 'owner');
    await s.removeResult(prompt, 'author', 'r1');
    expect(results).toHaveLength(0);
    expect(prompt.save).toHaveBeenCalled();
  });

  it('removeResult lets the prompt owner remove any result', async () => {
    const s = service();
    const results = [{ _id: { toString: () => 'r1' }, createdBy: 'author' }];
    const prompt = promptDoc(results, 'owner');
    await s.removeResult(prompt, 'owner', 'r1');
    expect(results).toHaveLength(0);
  });
});
