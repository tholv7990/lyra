import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type AssetDocument = HydratedDocument<Asset>;

// A media asset produced by a run step (image/video/audio). Storage-agnostic:
// `url` points at wherever the bytes live (a CDN/R2 URL once real rendering
// lands; a placeholder while the providers are mocked). Soft-deletable + audited
// like every other collection; scoped to a workspace.
@Schema({ timestamps: true })
export class Asset extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  runId!: string;

  @Prop({ required: true })
  stepIndex!: number;

  @Prop({ required: true, enum: ['image', 'video', 'audio'] })
  type!: 'image' | 'video' | 'audio';

  @Prop({ required: true })
  url!: string;

  @Prop()
  thumbUrl?: string;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;

  @Prop({ default: false })
  approved?: boolean;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
AssetSchema.index({ runId: 1, stepIndex: 1 });
