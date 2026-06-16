import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { ApiKey, ApiKeySchema } from './api-key.schema';
import { KeysService } from './keys.service';
import { EncryptionService } from './encryption.service';
import { KeysController } from './keys.controller';

@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    UsersModule, // UsersService (ref expansion)
    MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]),
  ],
  controllers: [KeysController],
  providers: [KeysService, EncryptionService],
  exports: [KeysService],
})
export class KeysModule {}
