import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Provider } from '@lyra/shared';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { BaseRepository } from '../common/database/base.repository';
import { EncryptionService } from './encryption.service';

@Injectable()
export class KeysService extends BaseRepository<ApiKey> {
  constructor(
    @InjectModel(ApiKey.name) model: Model<ApiKey>,
    private readonly encryption: EncryptionService,
  ) {
    super(model);
  }

  list(workspaceId: string) {
    return this.find({ workspaceId }, { sort: { provider: 1 } });
  }

  // Create or replace the key for a provider; returns the stored document.
  async upsert(
    workspaceId: string,
    provider: Provider,
    plaintext: string,
    updatedBy: string,
  ): Promise<ApiKeyDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        { workspaceId, provider },
        {
          workspaceId,
          provider,
          encryptedKey: this.encryption.encrypt(plaintext),
          last4: plaintext.slice(-4),
          updatedBy,
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return doc!;
  }

  removeKey(workspaceId: string, provider: Provider) {
    return this.deleteOne({ workspaceId, provider });
  }

  // For later phases (running steps): decrypt the stored key, or null if unset.
  async getDecrypted(
    workspaceId: string,
    provider: Provider,
  ): Promise<string | null> {
    const doc = await this.findOne({ workspaceId, provider });
    return doc ? this.encryption.decrypt(doc.encryptedKey) : null;
  }
}
