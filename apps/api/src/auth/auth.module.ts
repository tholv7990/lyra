import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MailModule } from '../mail/mail.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.schema';
import { PasswordReset, PasswordResetSchema } from './password-reset.schema';
import {
  EmailVerification,
  EmailVerificationSchema,
} from './email-verification.schema';

@Module({
  imports: [
    UsersModule,
    WorkspacesModule,
    MailModule,
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: EmailVerification.name, schema: EmailVerificationSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
