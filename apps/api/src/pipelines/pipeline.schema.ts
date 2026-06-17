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

  // When set, this step maps its prompt over a named run collection (parallel).
  @Prop({ type: Object })
  fanOut?: { over: string; itemVar?: string };
}
const PipelineStepItemSchema = SchemaFactory.createForClass(PipelineStepItem);

@Schema({ _id: false })
export class PipelineVariableItem {
  @Prop({ required: true, trim: true }) key!: string;
  @Prop() label?: string;
  @Prop() default?: string;
}
const PipelineVariableItemSchema = SchemaFactory.createForClass(PipelineVariableItem);

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

  @Prop({ type: [PipelineVariableItemSchema], default: [] })
  variables!: PipelineVariableItem[];
}

export const PipelineSchema = SchemaFactory.createForClass(Pipeline);
PipelineSchema.index({ workspaceId: 1, createdAt: -1 });
PipelineSchema.index({ workspaceId: 1, tags: 1 });
