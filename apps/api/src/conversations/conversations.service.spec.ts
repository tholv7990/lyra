import { Provider } from '@lyra/shared';
import { ConversationsService } from './conversations.service';

// Stub the view mappers so the test focuses on the recall→system-prompt wiring.
jest.mock('./conversation.views', () => ({
  conversationActorIds: () => [],
  toConversation: (d: unknown) => d,
  toConversationMessage: (m: unknown) => m,
  toConversationSummary: (d: unknown) => d,
}));

function makeConvo() {
  return {
    workspaceId: 'ws',
    messages: [] as unknown[],
    title: '',
    updatedBy: '',
    save: jest.fn().mockResolvedValue(undefined),
  } as never;
}

function makeService(recall: jest.Mock, stream: jest.Mock) {
  const anthropic = { stream } as never;
  const memory = { recall } as never;
  // model/users/keys/files/openai are unused on the Anthropic path with no media.
  return new ConversationsService({} as never, {} as never, {} as never, {} as never, anthropic, {} as never, memory);
}

const dto = { provider: Provider.Anthropic, model: 'claude', content: 'hello', media: [] };

describe('ConversationsService recall-on-start', () => {
  it('recalls workspace memories and injects them into the system prompt', async () => {
    const stream = jest.fn().mockResolvedValue({ text: 'hi', usage: {}, aborted: false });
    const recall = jest.fn().mockResolvedValue([
      { kind: 'preference', text: 'prefers 9:16' },
      { kind: 'fact', text: 'sells dog beds' },
    ]);
    const svc = makeService(recall, stream);

    await svc.streamReply(makeConvo(), dto, 'key', 'u1', () => undefined, new AbortController().signal);

    expect(recall).toHaveBeenCalledWith('ws', { query: 'hello' }, 'u1');
    const sentSystem = stream.mock.calls[0][0].system as string;
    expect(sentSystem).toContain('prefers 9:16');
    expect(sentSystem).toContain('sells dog beds');
    expect(sentSystem).toContain('What you remember about this workspace');
  });

  it('still replies when recall fails (best-effort) and sends the base system', async () => {
    const stream = jest.fn().mockResolvedValue({ text: 'hi', usage: {}, aborted: false });
    const recall = jest.fn().mockRejectedValue(new Error('mongo down'));
    const svc = makeService(recall, stream);

    const res = await svc.streamReply(makeConvo(), dto, 'key', 'u1', () => undefined, new AbortController().signal);

    const sentSystem = stream.mock.calls[0][0].system as string;
    expect(sentSystem).not.toContain('What you remember about this workspace');
    expect(res.assistant).toBeDefined();
  });
});
