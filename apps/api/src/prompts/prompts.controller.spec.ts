import { PromptCategory, PromptType } from '@lyra/shared';
import { PromptsController } from './prompts.controller';

const user = { id: 'u1' } as never;

function make() {
  const service = {
    create: jest.fn().mockResolvedValue({}),
    toView: jest.fn().mockResolvedValue({}),
    toViews: jest.fn().mockResolvedValue([]),
    listPaged: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  };
  return { c: new PromptsController(service as never), service };
}

describe('PromptsController type metadata', () => {
  it('create defaults type to Text when omitted', async () => {
    const { c, service } = make();
    await c.create('ws-1', { title: 'T', content: 'C' } as never, user);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: PromptType.Text }),
    );
  });

  it('create persists the supplied type', async () => {
    const { c, service } = make();
    await c.create(
      'ws-1',
      { title: 'T', content: 'C', type: PromptType.Image } as never,
      user,
    );
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: PromptType.Image }),
    );
  });

  it('list parses the type query (repeated + comma-split) into valid enum values', async () => {
    const { c, service } = make();
    await c.list(
      'ws-1',
      user,
      undefined, // status
      undefined, // tag
      ['image', 'video,bogus'], // type: repeated AND comma-split, with an invalid value
    );
    expect(service.listPaged).toHaveBeenCalledWith(
      'ws-1',
      'u1',
      expect.objectContaining({ types: [PromptType.Image, PromptType.Video] }),
    );
  });

  it('list omits invalid-only types as an empty group', async () => {
    const { c, service } = make();
    await c.list('ws-1', user, undefined, undefined, 'nope');
    expect(service.listPaged).toHaveBeenCalledWith(
      'ws-1',
      'u1',
      expect.objectContaining({ types: [] }),
    );
  });
});

describe('PromptsController category metadata', () => {
  it('create omits category when not supplied (no default)', async () => {
    const { c, service } = make();
    await c.create('ws-1', { title: 'T', content: 'C' } as never, user);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: undefined }),
    );
  });

  it('create persists the supplied category', async () => {
    const { c, service } = make();
    await c.create(
      'ws-1',
      { title: 'T', content: 'C', category: PromptCategory.Coding } as never,
      user,
    );
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: PromptCategory.Coding }),
    );
  });

  it('list parses the category query (repeated + comma-split) into valid enum values', async () => {
    const { c, service } = make();
    await c.list(
      'ws-1',
      user,
      undefined, // status
      undefined, // tag
      undefined, // type
      ['Coding', 'Writing,bogus'], // category: repeated AND comma-split, with an invalid value
    );
    expect(service.listPaged).toHaveBeenCalledWith(
      'ws-1',
      'u1',
      expect.objectContaining({
        categories: [PromptCategory.Coding, PromptCategory.Writing],
      }),
    );
  });

  it('list omits invalid-only categories as an empty group', async () => {
    const { c, service } = make();
    await c.list('ws-1', user, undefined, undefined, undefined, 'nope');
    expect(service.listPaged).toHaveBeenCalledWith(
      'ws-1',
      'u1',
      expect.objectContaining({ categories: [] }),
    );
  });

  it('update with category:null clears it via $unset', async () => {
    const { c, service } = make();
    await c.update('p1', { category: null } as never, user);
    const patch = service.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.$unset).toEqual({ category: '' });
    expect('category' in patch).toBe(false);
  });

  it('update with a category value sets it', async () => {
    const { c, service } = make();
    await c.update('p1', { category: PromptCategory.Business } as never, user);
    const patch = service.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.category).toBe(PromptCategory.Business);
    expect(patch.$unset).toBeUndefined();
  });
});
