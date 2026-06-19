import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmailVerificationDocument = HydratedDocument<EmailVerification>;

// A pending email-confirmation request. The raw token is emailed; only its
// sha256 digest is stored. Single-use and TTL-pruned at expiry.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class EmailVerification {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const EmailVerificationSchema =
  SchemaFactory.createForClass(EmailVerification);

EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
