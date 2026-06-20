import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RequestType, RequestStatus } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type UserRequestDocument = HydratedDocument<UserRequest>;

// A user submission to the platform admins. One collection for every kind of
// request, discriminated by `type` (provider now; bug reports later).
@Schema({ timestamps: true })
export class UserRequest extends AuditedEntity {
  @Prop({ required: true, enum: Object.values(RequestType), index: true })
  type!: RequestType;

  @Prop({ required: true })
  subject!: string;

  // Normalized subject (trim + lowercase) — reserved so the upcoming voting
  // board can collapse "Google Gemini" and "gemini" onto one votable item.
  @Prop({ required: true, index: true })
  subjectKey!: string;

  @Prop({ default: '' })
  body!: string;

  @Prop({
    required: true,
    enum: Object.values(RequestStatus),
    default: RequestStatus.Open,
    index: true,
  })
  status!: RequestStatus;

  @Prop()
  adminNote?: string;

  @Prop()
  workspaceId?: string;

  // User ids who want this — the creator is the first voter, so a fresh request
  // starts at 1. The vote endpoint (toggling membership) is reserved.
  @Prop({ type: [String], default: [] })
  voters!: string[];
}

export const UserRequestSchema = SchemaFactory.createForClass(UserRequest);
UserRequestSchema.index({ status: 1, createdAt: -1 });
