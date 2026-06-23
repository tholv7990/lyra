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

  // NOT `required` — Mongoose's String `required` rejects '', and a step prompt
  // can legitimately be empty (an empty-content prompt, or an unbound step).
  @Prop({ default: '' })
  prompt!: string;

  // The prompt actually sent to the provider — `prompt` with {input}/{step:X}/
  // {variables} resolved at run time. Captured per execution; shown in step
  // details. Absent on older runs (the template is shown as a fallback).
  @Prop()
  sentPrompt?: string;

  // When set, the step maps its prompt over a named run collection (parallel).
  @Prop({ type: Object })
  fanOut?: { over: string; itemVar?: string };

  // Guard condition — the step is skipped (status 'skipped') when it fails.
  @Prop({ type: Object })
  condition?: { variable: string; op: string; value?: string };

  @Prop()
  kind?: string; // 'prompt' (default) | 'action'

  @Prop({ type: Object })
  action?: { type: string; position?: string; size?: string; source?: string; quality?: string; channelIds?: string[]; captionFrom?: string };

  @Prop()
  result?: string;

  @Prop({ type: [Object], default: undefined })
  evidence?: unknown[];

  @Prop({ type: [Object], default: undefined })
  sources?: unknown[];

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  @Prop({ type: [String] })
  assetIds?: string[];

  @Prop({ type: [String] })
  inputAssetIds?: string[];

  @Prop({ type: Object })
  usage?: { tokens?: number; costUsd?: number };

  @Prop()
  error?: string;

  @Prop()
  startedAt?: string;

  @Prop()
  finishedAt?: string;

  @Prop()
  cached?: boolean;
}
const RunStepSchema = SchemaFactory.createForClass(RunStep);

export type RunDocument = HydratedDocument<Run>;

@Schema({ timestamps: true })
export class Run extends AuditedEntity {
  // Absent for a builder "test run" (no project — just typed/blank context).
  @Prop({ index: true })
  projectId?: string;

  // The task this run belongs to (absent for a builder test run). Runs scope to
  // (taskId, pipelineId).
  @Prop({ index: true })
  taskId?: string;

  @Prop({ index: true })
  productId?: string;

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

  // Per-run thumbs (overall output quality). One verdict per run, last-writer-wins.
  // Seeds the AI builder's few-shot retrieval (top-rated pipelines as examples).
  @Prop({ type: Object })
  rating?: { value: string; by: string; at: string };
}

export const RunSchema = SchemaFactory.createForClass(Run);
RunSchema.index({ projectId: 1, createdAt: -1 });
