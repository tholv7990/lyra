import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Memory, MemorySchema } from './memory.schema';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [WorkspacesModule, UsersModule, MongooseModule.forFeature([{ name: Memory.name, schema: MemorySchema }])],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
