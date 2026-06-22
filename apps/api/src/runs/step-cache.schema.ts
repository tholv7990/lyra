import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { createHash } from 'crypto';

// Content-addressed key for a prompt step's execution. NUL-joined so field
// boundaries can't collide; sha256 hex. workspaceId is included so cache entries
// never cross tenants (invariant 5).
export function stepCacheKey(input: {
  workspaceId: string;
  provider: string;
  model: string;
  prompt: string;
}): string {
  const canonical = [input.workspaceId, input.provider, input.model, input.prompt].join(' ');
  return createHash('sha256').update(canonical).digest('hex');
}

// One cached prompt-step result (text + asset refs), reused across runs in a
// workspace to avoid re-spending. Mongo prunes entries past expiresAt (TTL).
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class StepResultCache {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, unique: true, index: true })
  cacheKey!: string;

  @Prop({ required: true })
  result!: string;

  @Prop({ type: Array, default: [] })
  assets?: { type: string; url: string; thumbUrl?: string; meta?: Record<string, unknown> }[];

  @Prop({ required: true })
  expiresAt!: Date;
}
export type StepResultCacheDocument = HydratedDocument<StepResultCache>;
export const StepResultCacheSchema = SchemaFactory.createForClass(StepResultCache);
// TTL: Mongo deletes entries whose expiresAt has passed.
StepResultCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
