import { describe, expect, test } from 'vitest';
import { Provider, type ConversationMessage } from '@lyra/shared';
import { seedChatDraft, updateMessageContent } from './Chats';

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

describe('seedChatDraft', () => {
  test('prefills the composer without creating a message payload', () => {
    const draft = seedChatDraft({
      seed: 'Run this later',
      provider: Provider.OpenAI,
      model: 'gpt-5.5-pro',
    }, Provider.Anthropic);

    expect(draft).toEqual({
      input: 'Run this later',
      provider: Provider.OpenAI,
      model: 'gpt-5.5-pro',
    });
  });

  test('carries the prompt origin id for the first manual send', () => {
    const draft = seedChatDraft({
      seed: 'Run this later',
      provider: Provider.OpenAI,
      model: 'gpt-5.5-pro',
      originPromptId: 'prompt-1',
    }, Provider.Anthropic);

    expect(draft?.originPromptId).toBe('prompt-1');
  });
});
