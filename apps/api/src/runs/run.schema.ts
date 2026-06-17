import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ _id: false })
export class RunStep {
  @Prop({ required: true })
  index!: number;

  // Fixed pipeline only; composable pipeline steps use name/promptId/provider.
  @Prop()
  key?: string;

  @Prop()
  name?: string;

  @Prop()
  promptId?: string;

  @Prop()
  provider?: string;

  @Prop({ required: true })
  mode!: string;

  @Prop({ required: true, default: 'idle' })
  status!: string;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true, default: '' })
  prompt!: string;

  // When set, the step maps its prompt over a named run collection (parallel).
  @Prop({ type: Object })
  fanOut?: { over: string; itemVar?: string };

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
export class Run extends AuditedEntity {
  // Absent for a builder "test run" (no project — just typed/blank context).
  @Prop({ index: true })
  projectId?: string;

  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ index: true })
  pipelineId?: string;

  @Prop()
  pipelineName?: string;

  // The pipeline note — the first step's default input. Product/niche/homepage
  // now live in `variables` (project-model-v2).
  @Prop({ type: Object })
  context?: { note?: string };

  // token→value snapshot resolved into step prompts at run time (project +
  // pipeline custom + system vars). Frozen at creation.
  @Prop({ type: Object })
  variables?: Record<string, string>;

  // Named lists a fan-out step maps over (frozen at creation). Arbitrary length.
  @Prop({ type: Object })
  collections?: Record<string, string[]>;

  @Prop({ required: true, default: 'idle' })
  status!: string;

  @Prop({ required: true, default: 0 })
  currentStep!: number;

  @Prop({ type: [RunStepSchema], default: [] })
  steps!: RunStep[];
}

export const RunSchema = SchemaFactory.createForClass(Run);
RunSchema.index({ projectId: 1, createdAt: -1 });
