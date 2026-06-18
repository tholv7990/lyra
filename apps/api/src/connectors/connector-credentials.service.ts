import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ConnectorCredentialInfo } from '@lyra/shared';
import { ConnectorCredential, ConnectorCredentialDocument } from './connector-credential.schema';
import { BaseRepository } from '../common/database/base.repository';
import { EncryptionService } from '../keys/encryption.service';
import { toConnectorCredentialInfo } from './connector-credential.views';

// Per-workspace encrypted connector credentials (e.g. the Postiz API key). Mirrors
// KeysService but kept separate from the AI-Provider key store. Never returns the key.
@Injectable()
export class ConnectorCredentialsService extends BaseRepository<ConnectorCredential> {
  constructor(
    @InjectModel(ConnectorCredential.name) model: Model<ConnectorCredential>,
    private readonly encryption: EncryptionService,
  ) {
    super(model);
  }

  async upsert(
    workspaceId: string, connector: string, plaintext: string, actorId: string,
  ): Promise<ConnectorCredentialInfo> {
    const doc = await this.model
      .findOneAndUpdate(
        { workspaceId, connector },
        {
          $set: {
            encryptedKey: this.encryption.encrypt(plaintext),
            last4: plaintext.slice(-4),
            updatedBy: actorId,
            active: true,
          },
          $setOnInsert: { workspaceId, connector, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return toConnectorCredentialInfo(doc as ConnectorCredentialDocument, connector);
  }

  async status(workspaceId: string, connector: string): Promise<ConnectorCredentialInfo> {
    const doc = await this.findOne({ workspaceId, connector });
    return toConnectorCredentialInfo(doc as ConnectorCredentialDocument | null, connector);
  }

  async getDecrypted(workspaceId: string, connector: string): Promise<string | null> {
    const doc = await this.findOne({ workspaceId, connector });
    return doc ? this.encryption.decrypt((doc as ConnectorCredentialDocument).encryptedKey) : null;
  }
}
