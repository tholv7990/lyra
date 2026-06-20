import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsProxy } from './connectors.proxy';
import { ConnectorCredential, ConnectorCredentialSchema } from './connector-credential.schema';
import { ConnectorCredentialsService } from './connector-credentials.service';
import { CrawlerCookiesService } from './crawler-cookies.service';
import { EncryptionService } from '../keys/encryption.service';

// Thin proxy module for the built-in connectors (publish + media import). Connector
// logic lives in the separate microservice; this forwards (or mocks). The Postiz
// API key is stored here, encrypted, and forwarded as X-Connector-Key.
@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    MongooseModule.forFeature([{ name: ConnectorCredential.name, schema: ConnectorCredentialSchema }]),
  ],
  controllers: [ConnectorsController],
  providers: [ConnectorsProxy, ConnectorCredentialsService, CrawlerCookiesService, EncryptionService],
})
export class ConnectorsModule {}
