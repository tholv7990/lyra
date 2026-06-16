import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Provider, StepMode } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ _id: false })
export class PipelineStepItem {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ required: true }) promptId!: string;
  @Prop({ required: true, enum: Object.values(Provider) }) provider!: Provider;
  @Prop({ required: true }) model!: string;
  @Prop({ required: true, enum: Object.values(StepMode), default: StepMode.Auto })
  mode!: StepMode;
}
const PipelineStepItemSchema = SchemaFactory.createForClass(PipelineStepItem);

export type PipelineDocument = HydratedDocument<Pipeline>;

@Schema({ timestamps: true })
export class Pipeline extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [PipelineStepItemSchema], default: [] })
  steps!: PipelineStepItem[];
}

export const PipelineSchema = SchemaFactory.createForClass(Pipeline);
PipelineSchema.index({ workspaceId: 1, createdAt: -1 });
PipelineSchema.index({ workspaceId: 1, tags: 1 });
