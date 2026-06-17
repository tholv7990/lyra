import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MediaType, Provider } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ _id: false })
export class ConvMediaItem {
  @Prop({ required: true, enum: Object.values(MediaType) }) type!: MediaType;
  @Prop({ required: true }) url!: string;
  @Prop() name?: string;
  @Prop() mime?: string;
  @Prop() size?: number;
}
const ConvMediaItemSchema = SchemaFactory.createForClass(ConvMediaItem);

// One turn in the conversation. Each message records the provider·model that
// produced it (user turn = what it was sent to; assistant turn = what answered).
// `timestamps: true` gives per-message createdAt; subdocs keep their own _id.
@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ required: true, default: '' })
  content!: string;

  @Prop({ type: [ConvMediaItemSchema], default: [] })
  media!: ConvMediaItem[];

  @Prop({ required: true, enum: Object.values(Provider) })
  provider!: Provider;

  @Prop({ required: true })
  model!: string;

  @Prop({ type: Object })
  usage?: { tokens?: number; costUsd?: number };

  @Prop()
  error?: string;

  // Populated by `timestamps: true` — declared for view mapping.
  createdAt?: Date;
  updatedAt?: Date;
}
const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, default: 'New chat' })
  title!: string;

  // The chat's current default provider·model (the composer pre-selects it).
  @Prop({ required: true, enum: Object.values(Provider) })
  provider!: Provider;

  @Prop({ required: true })
  model!: string;

  // Set when the chat was opened from a library prompt (soft link).
  @Prop()
  originPromptId?: string;

  @Prop({ required: true, default: false })
  starred!: boolean;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages!: ChatMessage[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
// Sidebar: the caller's chats in a workspace, most-recently-updated first.
ConversationSchema.index({ workspaceId: 1, createdBy: 1, updatedAt: -1 });
