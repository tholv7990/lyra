import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Provider } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({ timestamps: true })
export class ApiKey extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, enum: Object.values(Provider) })
  provider!: Provider;

  // Server-only: AES-256-GCM ciphertext. Never serialized to clients.
  @Prop({ required: true })
  encryptedKey!: string;

  @Prop({ required: true })
  last4!: string;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);

// One ACTIVE key per (workspace, provider) — partial so re-adding after a
// soft delete works.
ApiKeySchema.index(
  { workspaceId: 1, provider: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
