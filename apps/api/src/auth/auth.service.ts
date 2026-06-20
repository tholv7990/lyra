import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { Role } from '@lyra/shared';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MembershipsService } from '../workspaces/memberships.service';
import { MailerService } from '../mail/mailer.service';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';
import { PasswordReset, PasswordResetDocument } from './password-reset.schema';
import {
  EmailVerification,
  EmailVerificationDocument,
} from './email-verification.schema';
import type { User as SafeUser } from '@lyra/shared';

export interface AuthResult {
  accessToken: string;
  user: SafeUser;
}

const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour
const EMAIL_VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(RefreshToken.name)
    private readonly rtModel: Model<RefreshTokenDocument>,
    @InjectModel(PasswordReset.name)
    private readonly prModel: Model<PasswordResetDocument>,
    @InjectModel(EmailVerification.name)
    private readonly evModel: Model<EmailVerificationDocument>,
  ) {}

  private signAccess(userId: string): string {
    return this.jwt.sign({ sub: userId }, {
      secret:
        this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
      expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m',
    } as JwtSignOptions);
  }

  // High-entropy random tokens are stored as a sha256 digest (fast O(1)
  // lookup, not brute-forceable). Passwords use argon2; refresh tokens do not.
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    await this.rtModel.create({
      userId,
      tokenHash: this.hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    return raw;
  }

  private webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    await this.evModel.deleteMany({ userId }).exec();
    const raw = randomBytes(48).toString('hex');
    await this.evModel.create({
      userId,
      tokenHash: this.hashToken(raw),
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
    });
    const url = `${this.webOrigin()}/auth/verify-email?token=${raw}`;
    void this.mailer.sendEmailVerification(email, url);
  }

  // Re-send the verification link to a signed-in but unverified user (the Home
  // "confirm your email" step). No-op if already verified. Always returns ok so
  // the response never reveals account state.
  async resendVerification(userId: string): Promise<{ ok: true }> {
    const user = await this.users.findById(userId);
    if (user && user.emailVerified === false) {
      await this.sendVerificationEmail(userId, user.email);
    }
    return { ok: true };
  }

  async signup(
    email: string,
    password: string,
    name: string,
  ): Promise<{ ok: true }> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await argon2.hash(password);

    // Atomically create the user, their personal workspace, and the owner
    // membership — requires the replica set (see docker-compose / Atlas).
    const user = await this.connection.transaction(async (session) => {
      const created = await this.users.create(
        { email, passwordHash, name, emailVerified: false },
        session,
      );
      const ws = await this.workspaces.createPersonal(
        created._id.toString(),
        `${name}'s Workspace`,
        session,
      );
      await this.memberships.create(
        {
          workspaceId: ws._id.toString(),
          userId: created._id.toString(),
          role: Role.Owner,
          canManageKeys: false,
          createdBy: created._id.toString(),
          updatedBy: created._id.toString(),
        },
        session,
      );
      return created;
    });

    const userId = user._id.toString();
    await this.sendVerificationEmail(userId, user.email);
    return { ok: true };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ auth: AuthResult; refreshToken: string }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses Google sign-in — continue with Google.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    // Unverified password users CAN sign in, but are limited (browse Home +
    // Marketplace) until they confirm — the api blocks create/run actions and the
    // web restricts the nav. (Was: hard block here.)
    const userId = user._id.toString();
    const refreshToken = await this.issueRefreshToken(userId);
    return {
      auth: {
        accessToken: this.signAccess(userId),
        user: this.users.toSafeUser(user),
      },
      refreshToken,
    };
  }

  // Rotation: a valid refresh token is consumed (deleted) and replaced.
  async refresh(
    raw: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!raw) throw new UnauthorizedException('Missing refresh token');
    const matched = await this.rtModel
      .findOne({ tokenHash: this.hashToken(raw), expiresAt: { $gt: new Date() } })
      .exec();
    if (!matched) throw new UnauthorizedException('Invalid refresh token');
    const userId = matched.userId;
    await this.rtModel.deleteOne({ _id: matched._id }).exec();
    const refreshToken = await this.issueRefreshToken(userId);
    return { accessToken: this.signAccess(userId), refreshToken };
  }

  async logout(raw: string | undefined): Promise<void> {
    if (!raw) return;
    await this.rtModel.deleteOne({ tokenHash: this.hashToken(raw) }).exec();
  }

  // Change password for a logged-in user. Verifies the current password, sets
  // the new one, then revokes EVERY refresh token (logs out other devices) and
  // issues a fresh one so this session stays signed in.
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ auth: AuthResult; refreshToken: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid session');
    if (!user.passwordHash) {
      // Google-only account — no password to verify against. They'd set one via
      // the reset-by-email flow instead.
      throw new BadRequestException('This account uses Google sign-in.');
    }
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    user.passwordHash = await argon2.hash(newPassword);
    await user.save();

    await this.rtModel.deleteMany({ userId }).exec();
    const refreshToken = await this.issueRefreshToken(userId);
    void this.mailer.sendPasswordChanged(user.email);
    return {
      auth: {
        accessToken: this.signAccess(userId),
        user: this.users.toSafeUser(user),
      },
      refreshToken,
    };
  }

  // Start a reset: if the email exists, store a hashed single-use token and mail
  // the link. Always resolves (never reveal whether an account exists).
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    const userId = user._id.toString();
    // Only the newest link should work — invalidate any prior outstanding tokens.
    await this.prModel.deleteMany({ userId }).exec();
    const raw = randomBytes(48).toString('hex');
    await this.prModel.create({
      userId,
      tokenHash: this.hashToken(raw),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const url = `${this.webOrigin()}/reset-password?token=${raw}`;
    // Fire-and-forget: don't let send latency widen an email-enumeration timing
    // oracle (the response is already uniform). Mirrors changePassword.
    void this.mailer.sendPasswordReset(user.email, url);
  }

  // Complete a reset: validate the token, set the new password, consume the
  // token, and revoke all sessions (the user signs in again).
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const reset = await this.prModel
      .findOne({ tokenHash: this.hashToken(rawToken), expiresAt: { $gt: new Date() } })
      .exec();
    if (!reset) throw new BadRequestException('This reset link is invalid or has expired');

    const user = await this.users.findById(reset.userId);
    if (!user) throw new BadRequestException('This reset link is invalid or has expired');

    user.passwordHash = await argon2.hash(newPassword);
    await user.save();

    await this.prModel.deleteMany({ userId: reset.userId }).exec();
    await this.rtModel.deleteMany({ userId: reset.userId }).exec();
    void this.mailer.sendPasswordChanged(user.email);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const verification = await this.evModel
      .findOne({ tokenHash: this.hashToken(rawToken), expiresAt: { $gt: new Date() } })
      .exec();
    if (!verification) {
      throw new BadRequestException('This confirmation link is invalid or has expired');
    }

    const user = await this.users.findById(verification.userId);
    if (!user) {
      throw new BadRequestException('This confirmation link is invalid or has expired');
    }

    user.emailVerified = true;
    await user.save();
    await this.evModel.deleteMany({ userId: verification.userId }).exec();
  }

  // ===== Google sign-in (OAuth 2.0 authorization-code flow) =====

  googleConfigured(): boolean {
    return (
      !!this.config.get<string>('GOOGLE_CLIENT_ID') &&
      !!this.config.get<string>('GOOGLE_CLIENT_SECRET')
    );
  }

  private googleClient(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured');
    const origin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
    const callback =
      this.config.get<string>('GOOGLE_CALLBACK_URL') ?? `${origin}/auth/google/callback`;
    return new OAuth2Client(clientId, clientSecret, callback);
  }

  // The consent URL to redirect the browser to.
  googleAuthUrl(state: string): string {
    return this.googleClient().generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      state,
    });
  }

  // Exchange the callback code for the user's verified profile, then find-or-
  // create a (passwordless) account with the same onboarding as signup, and
  // issue a refresh token. Returns the raw refresh token for the cookie.
  async loginWithGoogle(code: string): Promise<{ refreshToken: string }> {
    const client = this.googleClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new UnauthorizedException('Google sign-in failed');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Your Google email is not verified');
    }
    const email = payload.email.toLowerCase();
    const name = payload.name?.trim() || email.split('@')[0];
    const googleId = payload.sub;

    let user = await this.users.findByEmail(email);
    if (!user) {
      user = await this.connection.transaction(async (session) => {
        const created = await this.users.create(
          { email, name, googleId, emailVerified: true },
          session,
        );
        const ws = await this.workspaces.createPersonal(
          created._id.toString(),
          `${name}'s Workspace`,
          session,
        );
        await this.memberships.create(
          {
            workspaceId: ws._id.toString(),
            userId: created._id.toString(),
            role: Role.Owner,
            canManageKeys: false,
            createdBy: created._id.toString(),
            updatedBy: created._id.toString(),
          },
          session,
        );
        return created;
      });
    } else if (!user.googleId) {
      // existing email/password account — link Google to it
      user.googleId = googleId;
      user.emailVerified = true;
      await user.save();
    } else if (user.emailVerified === false) {
      user.emailVerified = true;
      await user.save();
    }

    const refreshToken = await this.issueRefreshToken(user._id.toString());
    return { refreshToken };
  }
}
