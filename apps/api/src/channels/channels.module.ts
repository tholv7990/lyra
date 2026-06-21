import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Channel, ChannelSchema } from './channel.schema';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ConnectorsModule } from '../connectors/connectors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

// Unified channels. ConnectorsModule supplies the Postiz pool (proxy + credentials);
// WorkspacesModule supplies the WorkspaceGuard + canManageKeys.
@Module({
  imports: [
    ConnectorsModule,
    WorkspacesModule,
    MongooseModule.forFeature([{ name: Channel.name, schema: ChannelSchema }]),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
