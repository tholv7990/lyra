import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MediaType, PromptStatus, PromptType } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ _id: false })
export class PromptMediaItem {
  @Prop({ required: true, enum: Object.values(MediaType) })
  type!: MediaType;

  @Prop({ required: true })
  url!: string;

  @Prop()
  name?: string;

  @Prop()
  mime?: string;

  @Prop()
  size?: number;
}
const PromptMediaItemSchema = SchemaFactory.createForClass(PromptMediaItem);

// A saved answer kept under a prompt (the child in the prompt→results model).
// Keeps its own _id so a single result can be removed/rated. `createdBy` is the
// user who saved it; `promptSnapshot` is the prompt wording used to produce it.
@Schema({ _id: true })
export class PromptResultItem {
  @Prop({ required: true })
  output!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true, default: '' })
  promptSnapshot!: string;

  @Prop()
  rating?: number;

  @Prop()
  note?: string;

  @Prop()
  sourceConversationId?: string;

  @Prop({ required: true })
  createdBy!: string;

  @Prop({ type: Date, default: Date.now })
  savedAt!: Date;
}
const PromptResultItemSchema = SchemaFactory.createForClass(PromptResultItem);

export type PromptDocument = HydratedDocument<Prompt>;

@Schema({ timestamps: true })
export class Prompt extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, default: '' })
  content!: string;

  @Prop({
    required: true,
    enum: Object.values(PromptStatus),
    default: PromptStatus.Draft,
    index: true,
  })
  status!: PromptStatus;

  // The kind of output this prompt is for. Metadata only (badge + filter) —
  // does NOT change how the prompt runs.
  @Prop({ type: String, enum: Object.values(PromptType), default: PromptType.Text })
  type!: PromptType;

  // Attachments sent to the AI provider alongside the prompt.
  @Prop({ type: [PromptMediaItemSchema], default: [] })
  media!: PromptMediaItem[];

  // Free-form tags for filtering. Stored canonical (deduped via shared utils).
  @Prop({ type: [String], default: [] })
  tags!: string[];

  // Default provider + model for testing this prompt (pre-selected in the
  // playground). Optional.
  @Prop()
  provider?: string;

  @Prop()
  model?: string;

  // Curated saved answers (children of this prompt), gathered across chats.
  @Prop({ type: [PromptResultItemSchema], default: [] })
  results!: PromptResultItem[];
}

export const PromptSchema = SchemaFactory.createForClass(Prompt);
PromptSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
PromptSchema.index({ workspaceId: 1, createdBy: 1 });
PromptSchema.index({ workspaceId: 1, tags: 1 });
