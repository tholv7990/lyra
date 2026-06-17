import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PasswordResetDocument = HydratedDocument<PasswordReset>;

// A pending password-reset request. The raw token is emailed; only its sha256
// digest is stored. Single-use (deleted on use) and TTL-pruned at expiry.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class PasswordReset {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

// TTL index: Mongo prunes expired reset tokens automatically.
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
