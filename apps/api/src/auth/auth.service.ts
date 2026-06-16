import {
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
import { Role } from '@lyra/shared';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MembershipsService } from '../workspaces/memberships.service';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';
import type { User as SafeUser } from '@lyra/shared';

export interface AuthResult {
  accessToken: string;
  user: SafeUser;
}

const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(RefreshToken.name)
    private readonly rtModel: Model<RefreshTokenDocument>,
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

  async signup(
    email: string,
    password: string,
    name: string,
  ): Promise<{ auth: AuthResult; refreshToken: string }> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await argon2.hash(password);

    // Atomically create the user, their personal workspace, and the owner
    // membership — requires the replica set (see docker-compose / Atlas).
    const user = await this.connection.transaction(async (session) => {
      const created = await this.users.create(
        { email, passwordHash, name },
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
        },
        session,
      );
      return created;
    });

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

  async login(
    email: string,
    password: string,
  ): Promise<{ auth: AuthResult; refreshToken: string }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
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
}
