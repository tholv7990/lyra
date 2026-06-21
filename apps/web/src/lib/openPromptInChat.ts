import type { NavigateFunction } from 'react-router-dom';
import { defaultModel, Provider, type ConversationSummary, type Prompt } from '@lyra/shared';
import { api } from './api';

/** Where a chat was opened from — drives the in-chat breadcrumb + back link. */
export type ChatOrigin = { label: string; to: string; record: string };

/**
 * Open a library prompt in the Chats workbench: resume its latest linked chat if one
 * exists (so "Save answer" works against the parent prompt), otherwise open `/chats`
 * seeded with its content + provider/model. The composer is prefilled but NOT sent —
 * the user chooses when to send. Shared by the prompt library's "Open in chat" and the
 * pipeline-step "Try" action (which passes the step's own provider/model override).
 */
export async function openPromptInChat(
  p: Pick<Prompt, 'id' | 'content' | 'provider' | 'model'>,
  opts: {
    wsId: string;
    navigate: NavigateFunction;
    from: ChatOrigin;
    /** Override the seed provider/model (the step Try uses the step's, not the prompt's). */
    provider?: Provider;
    model?: string;
  },
) {
  const { wsId, navigate, from } = opts;
  const prov = opts.provider ?? p.provider ?? Provider.Anthropic;
  const model = opts.model ?? p.model ?? defaultModel(prov);
  try {
    const existing = await api<ConversationSummary | null>(
      `/workspaces/${wsId}/conversations/prompt-history`,
      { method: 'POST', body: JSON.stringify({ promptId: p.id, content: p.content }) },
    );
    if (existing) {
      // Ensure the conversation is linked to this prompt — otherwise "Save answer"
      // (which gates on the parent prompt) never appears. A legacy/content match may
      // return an unlinked conversation; link it now.
      if (existing.originPromptId !== p.id) {
        try {
          await api(`/conversations/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ originPromptId: p.id }),
          });
        } catch {
          // non-fatal: the chat still opens (just without the save link)
        }
      }
      navigate(`/chats/${existing.id}`, { state: { from } });
      return;
    }
  } catch {
    // fall through to a draft chat
  }
  navigate('/chats', {
    state: { seed: p.content, provider: prov, model, originPromptId: p.id, from },
  });
}
