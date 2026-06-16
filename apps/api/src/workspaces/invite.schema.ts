import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '@lyra/shared';

export type InviteDocument = HydratedDocument<Invite>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Invite {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, enum: Object.values(Role) })
  role!: Role;

  // sha256 of the one-time invite token — never the raw token.
  @Prop({ required: true, index: true })
  tokenHash!: string;

  @Prop({
    required: true,
    enum: ['pending', 'accepted', 'revoked'],
    default: 'pending',
  })
  status!: 'pending' | 'accepted' | 'revoked';

  @Prop({ required: true })
  invitedBy!: string; // userId

  @Prop({ required: true })
  expiresAt!: Date;

  createdAt!: Date;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);

// TTL: Mongo prunes invites after they expire.
InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
