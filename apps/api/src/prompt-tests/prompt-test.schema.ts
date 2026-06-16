import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Provider } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type PromptTestDocument = HydratedDocument<PromptTest>;

@Schema({ timestamps: true })
export class PromptTest extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  promptId!: string;

  @Prop({ required: true, enum: Object.values(Provider) })
  provider!: Provider;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true })
  input!: string;

  @Prop({ required: true, default: '' })
  result!: string;

  @Prop({ type: Object })
  usage?: { tokens?: number; costUsd?: number };

  @Prop({ required: true, default: false, index: true })
  starred!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop()
  error?: string;
}

export const PromptTestSchema = SchemaFactory.createForClass(PromptTest);
PromptTestSchema.index({ workspaceId: 1, promptId: 1, createdAt: -1 });
PromptTestSchema.index({ workspaceId: 1, promptId: 1, starred: 1 });
