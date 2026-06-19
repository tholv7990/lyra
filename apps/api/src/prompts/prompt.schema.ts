import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MediaType, PromptCategory, PromptStatus, PromptType } from '@lyra/shared';
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

  // Optional top-level grouping for the library. Metadata only (badge + filter) —
  // does NOT change how the prompt runs. No default: a prompt may have none.
  @Prop({ type: String, enum: Object.values(PromptCategory), required: false })
  category?: PromptCategory;

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
}

export const PromptSchema = SchemaFactory.createForClass(Prompt);
PromptSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
PromptSchema.index({ workspaceId: 1, createdBy: 1 });
PromptSchema.index({ workspaceId: 1, tags: 1 });
