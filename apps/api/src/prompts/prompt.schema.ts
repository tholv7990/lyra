import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MediaType, PromptStatus, StepKey } from '@lyra/shared';
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

  // Maps to a pipeline step (find/crawl/brief/insight/prompts/images/video/qa).
  @Prop({ required: true, enum: Object.values(StepKey), index: true })
  type!: StepKey;

  @Prop({
    required: true,
    enum: Object.values(PromptStatus),
    default: PromptStatus.Draft,
    index: true,
  })
  status!: PromptStatus;

  // Attachments sent to the AI provider alongside the prompt.
  @Prop({ type: [PromptMediaItemSchema], default: [] })
  media!: PromptMediaItem[];
}

export const PromptSchema = SchemaFactory.createForClass(Prompt);
PromptSchema.index({ workspaceId: 1, status: 1, type: 1 });
PromptSchema.index({ workspaceId: 1, createdBy: 1 });
