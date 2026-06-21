import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type PublishedPostDocument = HydratedDocument<PublishedPost>;

// One per-channel outcome (mirrors shared Receipt).
@Schema({ _id: false })
export class PostTarget {
  @Prop({ required: true }) platform!: string;
  @Prop({ required: true }) accountId!: string;
  @Prop() url?: string;
  @Prop() postId?: string;
  @Prop({ required: true }) status!: string; // 'ok' | 'failed'
  @Prop() error?: string;
}
const PostTargetSchema = SchemaFactory.createForClass(PostTarget);

// A recorded publish to a project's channels — the project's post history.
@Schema({ timestamps: true })
export class PublishedPost extends AuditedEntity {
  @Prop({ required: true, index: true }) workspaceId!: string;
  @Prop({ required: true, index: true }) projectId!: string;
  @Prop({ default: '' }) caption!: string;
  @Prop({ type: [String], default: [] }) mediaUrls!: string[];
  @Prop({ type: [String], default: [], index: true }) channelIds!: string[];
  @Prop({ type: [PostTargetSchema], default: [] }) targets!: PostTarget[];
  @Prop({ required: true }) status!: string; // 'ok' | 'partial' | 'failed'
}

export const PublishedPostSchema = SchemaFactory.createForClass(PublishedPost);
PublishedPostSchema.index({ projectId: 1, createdAt: -1 });
