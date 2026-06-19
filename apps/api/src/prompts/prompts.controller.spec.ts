import { PromptType } from '@lyra/shared';
import { PromptsController } from './prompts.controller';

const user = { id: 'u1' } as never;

function make() {
  const service = {
    create: jest.fn().mockResolvedValue({}),
    toView: jest.fn().mockResolvedValue({}),
    toViews: jest.fn().mockResolvedValue([]),
    listPaged: jest.fn().mockResolvedValue({ items: [], total: 0 }),
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
