import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsProxy } from './connectors.proxy';

// Thin proxy module for the built-in connectors (publish + media import). The real
// connector logic lives in a separate microservice; this only forwards (or mocks
// when CONNECTORS_SERVICE_URL is unset).
@Module({
  imports: [WorkspacesModule], // WorkspaceGuard + MembershipsService
  controllers: [ConnectorsController],
  providers: [ConnectorsProxy],
})
export class ConnectorsModule {}
