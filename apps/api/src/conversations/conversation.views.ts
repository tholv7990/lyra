import type {
  Conversation as ConversationModel,
  ConversationMessage,
  ConversationSummary,
  MediaType,
  PromptMedia,
  Provider,
  UserRef,
} from '@lyra/shared';
import type { ConversationDocument } from './conversation.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

// The persisted subdoc shape (Mongoose adds _id + createdAt to embedded
// messages; the schema class types them loosely, so narrow here for mapping).
export interface PersistedMsg {
  _id: { toString(): string };
  role: 'user' | 'assistant';
  content: string;
  media?: { type: MediaType; url: string; name?: string; mime?: string; size?: number }[];
  provider: Provider;
  model: string;
  usage?: { tokens?: number; costUsd?: number };
  error?: string;
  createdAt?: Date;
}

function messages(c: ConversationDocument): PersistedMsg[] {
  return (c.messages ?? []) as unknown as PersistedMsg[];
}

export function toConversationMessage(m: PersistedMsg): ConversationMessage {
  return {
    id: m._id.toString(),
    role: m.role,
    content: m.content,
    media: (m.media ?? []).map(
      (x): PromptMedia => ({ type: x.type, url: x.url, name: x.name, mime: x.mime, size: x.size }),
    ),
    provider: m.provider,
    model: m.model,
    usage: m.usage,
    error: m.error,
    createdAt: iso(m.createdAt),
  };
}

export function toConversation(
  c: ConversationDocument,
  refs: Map<string, UserRef>,
): ConversationModel {
  return {
    id: c._id.toString(),
    workspaceId: c.workspaceId,
    title: c.title,
    provider: c.provider,
    model: c.model,
    originPromptId: c.originPromptId,
    starred: c.starred ?? false,
    messages: messages(c).map(toConversationMessage),
    active: c.active ?? true,
    createdBy: userRef(c.createdBy, refs),
    updatedBy: userRef(c.updatedBy, refs),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt ?? c.createdAt),
  };
}

// Lightweight list item for the sidebar — no message bodies.
export function toConversationSummary(c: ConversationDocument): ConversationSummary {
  const msgs = messages(c);
  const last = msgs[msgs.length - 1];
  return {
    id: c._id.toString(),
    title: c.title,
    provider: c.provider,
    model: c.model,
    originPromptId: c.originPromptId,
    starred: c.starred ?? false,
    messageCount: msgs.length,
    lastMessageAt: last ? iso(last.createdAt) : undefined,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt ?? c.createdAt),
  };
}

export function conversationActorIds(c: ConversationDocument): string[] {
  return [c.createdBy, c.updatedBy];
}
