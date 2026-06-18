import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectsModule } from './projects/projects.module';
import { KeysModule } from './keys/keys.module';
import { RunsModule } from './runs/runs.module';
import { AssetsModule } from './assets/assets.module';
import { PromptsModule } from './prompts/prompts.module';
import { ConversationsModule } from './conversations/conversations.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { CopilotModule } from './copilot/copilot.module';
import { ModelsModule } from './models/models.module';
import { LabelsModule } from './labels/labels.module';
import { FilesModule } from './files/files.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGODB_URI') ??
          'mongodb://localhost:27017/lyra',
        // Auto-indexing off in production — build indexes via migrations.
        autoIndex: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    KeysModule,
    RunsModule,
    AssetsModule,
    PromptsModule,
    ConversationsModule,
    PipelinesModule,
    CopilotModule,
    ModelsModule,
    LabelsModule,
    FilesModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guards run in order: authenticate, then rate-limit.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
