import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Provider, StepMode } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ _id: false })
export class PipelineStepItem {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true, trim: true }) name!: string;
  // Empty string = a "gap" step (AI couldn't match a library prompt yet). Not
  // `required` so a gap step persists; the builder badges it until filled.
  @Prop({ default: '' }) promptId!: string;
  @Prop({ required: true, enum: Object.values(Provider) }) provider!: Provider;
  @Prop({ required: true }) model!: string;
  @Prop({ required: true, enum: Object.values(StepMode), default: StepMode.Auto })
  mode!: StepMode;

  // When set, this step maps its prompt over a named run collection (parallel).
  @Prop({ type: Object })
  fanOut?: { over: string; itemVar?: string };

  // Guard condition — the step is skipped when it fails.
  @Prop({ type: Object })
  condition?: { variable: string; op: string; value?: string };

  // Kind of step — 'prompt' (default) or 'action'
  @Prop()
  kind?: string; // 'prompt' (default) | 'action'

  // Action payload for action steps
  @Prop({ type: Object })
  action?: { type: string; position?: string; size?: string; source?: string; quality?: string; channelIds?: string[]; captionFrom?: string };
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

  // Provenance — set when AI generated this pipeline (source/goal/model). Absent
  // for manually-built pipelines. Seeds future "learn from good pipelines".
  @Prop({ type: Object })
  origin?: { source: string; goal?: string; model?: string };
}

export const PipelineSchema = SchemaFactory.createForClass(Pipeline);
PipelineSchema.index({ workspaceId: 1, createdAt: -1 });
PipelineSchema.index({ workspaceId: 1, tags: 1 });
