import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type ChannelDocument = HydratedDocument<Channel>;

// A workspace-owned channel. Only non-Postiz channels are stored here (Postiz
// channels auto-import from the pool) — currently just GoLogin. `type` discriminates
// how it publishes; GoLogin carries the profile to drive.
@Schema({ timestamps: true })
export class Channel extends AuditedEntity {
  @Prop({ required: true, index: true }) workspaceId!: string;
  @Prop({ required: true }) type!: string; // 'gologin'
  @Prop({ required: true }) platform!: string;
  @Prop({ required: true }) displayName!: string;
  @Prop() profileId?: string;
  @Prop() proxy?: string;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
ChannelSchema.index({ workspaceId: 1, createdAt: -1 });
