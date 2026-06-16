import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Provider } from '@lyra/shared';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({ timestamps: { createdAt: true, updatedAt: true } })
export class ApiKey {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, enum: Object.values(Provider) })
  provider!: Provider;

  // Server-only: AES-256-GCM ciphertext. Never serialized to clients.
  @Prop({ required: true })
  encryptedKey!: string;

  @Prop({ required: true })
  last4!: string;

  @Prop({ required: true })
  updatedBy!: string;

  updatedAt!: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);

// One key per provider per workspace.
ApiKeySchema.index({ workspaceId: 1, provider: 1 }, { unique: true });
