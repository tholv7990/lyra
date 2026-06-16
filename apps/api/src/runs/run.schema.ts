import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class RunStep {
  @Prop({ required: true })
  index!: number;

  @Prop({ required: true })
  key!: string;

  @Prop({ required: true })
  mode!: string;

  @Prop({ required: true, default: 'idle' })
  status!: string;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true, default: '' })
  prompt!: string;

  @Prop()
  result?: string;

  @Prop({ type: [String] })
  assetIds?: string[];

  @Prop({ type: Object })
  usage?: { tokens?: number; costUsd?: number };

  @Prop()
  error?: string;

  @Prop()
  startedAt?: string;

  @Prop()
  finishedAt?: string;
}
const RunStepSchema = SchemaFactory.createForClass(RunStep);

export type RunDocument = HydratedDocument<Run>;

@Schema({ timestamps: true })
export class Run {
  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  createdBy!: string;

  @Prop({ required: true, default: 'idle' })
  status!: string;

  @Prop({ required: true, default: 0 })
  currentStep!: number;

  @Prop({ type: [RunStepSchema], default: [] })
  steps!: RunStep[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const RunSchema = SchemaFactory.createForClass(Run);
RunSchema.index({ projectId: 1, createdAt: -1 });
