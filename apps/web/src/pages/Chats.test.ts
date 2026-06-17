import { describe, expect, test } from 'vitest';
import { Provider, type ConversationMessage } from '@lyra/shared';
import { updateMessageContent } from './Chats';

function message(id: string, content: string): ConversationMessage {
  return {
    id,
    role: 'user',
    content,
    provider: Provider.Anthropic,
    model: 'claude-sonnet-4',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('Chats message editing', () => {
  test('updates the message content used later by Save as prompt', () => {
    const messages = [message('m1', 'old prompt'), message('m2', 'another prompt')];

    const updated = updateMessageContent(messages, 'm1', 'edited prompt');

    expect(updated.find((m) => m.id === 'm1')?.content).toBe('edited prompt');
    expect(updated.find((m) => m.id === 'm2')?.content).toBe('another prompt');
  });
});
