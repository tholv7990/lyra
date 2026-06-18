import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type ConnectorCredentialDocument = HydratedDocument<ConnectorCredential>;

@Schema({ timestamps: true })
export class ConnectorCredential extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  connector!: string; // e.g. 'postiz'

  // Server-only: AES-256-GCM ciphertext. Never serialized to clients.
  @Prop({ required: true })
  encryptedKey!: string;

  @Prop({ required: true })
  last4!: string;
}

export const ConnectorCredentialSchema = SchemaFactory.createForClass(ConnectorCredential);

// One ACTIVE credential per (workspace, connector) — partial so re-adding after a
// soft delete works (mirrors ApiKey).
ConnectorCredentialSchema.index(
  { workspaceId: 1, connector: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
