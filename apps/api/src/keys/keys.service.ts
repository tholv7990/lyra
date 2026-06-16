import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Provider, type ApiKeyInfo } from '@lyra/shared';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { BaseRepository } from '../common/database/base.repository';
import { EncryptionService } from './encryption.service';
import { UsersService } from '../users/users.service';
import { toApiKeyInfo } from './key.views';

@Injectable()
export class KeysService extends BaseRepository<ApiKey> {
  constructor(
    @InjectModel(ApiKey.name) model: Model<ApiKey>,
    private readonly encryption: EncryptionService,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  list(workspaceId: string) {
    return this.find({ workspaceId }, { sort: { provider: 1 } });
  }

  async toView(doc: ApiKeyDocument): Promise<ApiKeyInfo> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toApiKeyInfo(doc, refs);
  }

  async toViews(docs: ApiKeyDocument[]): Promise<ApiKeyInfo[]> {
    const refs = await this.users.refMap(
      docs.flatMap((k) => [k.createdBy, k.updatedBy]),
    );
    return docs.map((k) => toApiKeyInfo(k, refs));
  }

  // Create or replace (and reactivate) the key for a provider.
  async upsert(
    workspaceId: string,
    provider: Provider,
    plaintext: string,
    actorId: string,
  ): Promise<ApiKeyDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        { workspaceId, provider },
        {
          $set: {
            encryptedKey: this.encryption.encrypt(plaintext),
            last4: plaintext.slice(-4),
            updatedBy: actorId,
            active: true,
          },
          $setOnInsert: { workspaceId, provider, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return doc!;
  }

  // Soft delete the key for a provider.
  removeKey(workspaceId: string, provider: Provider, actorId: string) {
    return this.model
      .findOneAndUpdate(
        { workspaceId, provider, active: { $ne: false } },
        { active: false, updatedBy: actorId },
      )
      .exec();
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
