import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CrawlerCookieInfo } from '@lyra/shared';
import { ConnectorCredential, ConnectorCredentialDocument } from './connector-credential.schema';
import { BaseRepository } from '../common/database/base.repository';
import { EncryptionService } from '../keys/encryption.service';

const CONNECTOR = 'crawler-cookies';

// Per-workspace encrypted Crawler cookies.txt (Netscape format), used by yt-dlp for
// logged-in / age-gated downloads. Reuses the ConnectorCredential collection +
// AES-256-GCM encryption. The contents are session secrets — never returned to a
// client (status is present/updatedAt only), never logged.
@Injectable()
export class CrawlerCookiesService extends BaseRepository<ConnectorCredential> {
  constructor(
    @InjectModel(ConnectorCredential.name) model: Model<ConnectorCredential>,
    private readonly encryption: EncryptionService,
  ) {
    super(model);
  }

  async set(workspaceId: string, cookies: string, actorId: string): Promise<CrawlerCookieInfo> {
    const doc = await this.model
      .findOneAndUpdate(
        { workspaceId, connector: CONNECTOR },
        {
          $set: {
            encryptedKey: this.encryption.encrypt(cookies),
            last4: 'n/a', // schema requires it; a cookie file has no meaningful non-secret hint
            updatedBy: actorId,
            active: true,
          },
          $setOnInsert: { workspaceId, connector: CONNECTOR, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return this.toInfo(doc as ConnectorCredentialDocument);
  }

  async status(workspaceId: string): Promise<CrawlerCookieInfo> {
    return this.toInfo((await this.findOne({ workspaceId, connector: CONNECTOR, active: true })) as ConnectorCredentialDocument | null);
  }

  async getDecrypted(workspaceId: string): Promise<string | null> {
    const doc = (await this.findOne({ workspaceId, connector: CONNECTOR, active: true })) as ConnectorCredentialDocument | null;
    return doc ? this.encryption.decrypt(doc.encryptedKey) : null;
  }

  async remove(workspaceId: string, actorId: string): Promise<void> {
    await this.model
      .updateOne({ workspaceId, connector: CONNECTOR, active: true }, { $set: { active: false, updatedBy: actorId } })
      .exec();
  }

  private toInfo(doc: ConnectorCredentialDocument | null): CrawlerCookieInfo {
    if (!doc) return { present: false };
    const updatedAt = (doc as unknown as { updatedAt?: Date }).updatedAt;
    return { present: true, ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : {}) };
  }
}
