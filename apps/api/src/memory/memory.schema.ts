import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MemoryKind } from '@lyra/shared';
import type { Memory as MemoryModel } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type MemoryDocument = HydratedDocument<Memory>;

@Schema({ timestamps: true })
export class Memory extends AuditedEntity {
  @Prop({ required: true, index: true }) workspaceId!: string;
  @Prop({ index: true }) userId?: string;
  @Prop({ required: true, enum: Object.values(MemoryKind) }) kind!: MemoryKind;
  @Prop({ required: true }) text!: string;
  @Prop({ type: String }) subjectType?: MemoryModel['subjectType'];
  @Prop({ index: true }) subjectId?: string;
  @Prop({ type: [String], default: undefined }) relatedIds?: string[];
  @Prop({ index: true }) dedupeKey?: string;
  @Prop({ required: true, default: 1 }) confidence!: number;
  @Prop({ required: true, default: 'explicit' }) provenance!: 'explicit' | 'inferred';
  @Prop({ type: Object }) source?: { conversationId?: string; runId?: string };
  @Prop() supersedes?: string;
  @Prop() lastUsedAt?: string;
}

export const MemorySchema = SchemaFactory.createForClass(Memory);
MemorySchema.index({ workspaceId: 1, active: 1, subjectId: 1 });
MemorySchema.index({ workspaceId: 1, kind: 1, updatedAt: -1 });
