import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MembershipsService } from '../workspaces/memberships.service';
import { MailerService } from '../mail/mailer.service';
import { RefreshToken } from './refresh-token.schema';
import { PasswordReset } from './password-reset.schema';

// In-memory stand-in for the RefreshToken Mongoose model — keeps the unit
// test free of any database so it runs in CI without downloading mongod.
function makeRtModel() {
  const store: Array<{ _id: string; userId: string; tokenHash: string; expiresAt: Date }> = [];
  let seq = 0;
  return {
    store,
    create: jest.fn(async (doc: any) => {
      const rec = { _id: `rt-${++seq}`, ...doc };
      store.push(rec);
      return rec;
    }),
    findOne: jest.fn((q: any) => ({
      exec: async () =>
        store.find(
          (r) => r.tokenHash === q.tokenHash && r.expiresAt > q.expiresAt.$gt,
        ) ?? null,
    })),
    deleteOne: jest.fn((q: any) => ({
      exec: async () => {
        const i = store.findIndex(
          (r) => (q._id && r._id === q._id) || (q.tokenHash && r.tokenHash === q.tokenHash),
        );
        if (i >= 0) store.splice(i, 1);
        return { deletedCount: i >= 0 ? 1 : 0 };
      },
    })),
    deleteMany: jest.fn((q: any) => ({
      exec: async () => {
        const before = store.length;
        for (let i = store.length - 1; i >= 0; i--) {
          if (!q.userId || store[i].userId === q.userId) store.splice(i, 1);
        }
        return { deletedCount: before - store.length };
      },
    })),
  };
}

// In-memory stand-in for the PasswordReset model.
function makePrModel() {
  const store: Array<{ _id: string; userId: string; tokenHash: string; expiresAt: Date }> = [];
  let seq = 0;
  return {
    store,
    create: jest.fn(async (doc: any) => {
      const rec = { _id: `pr-${++seq}`, ...doc };
      store.push(rec);
      return rec;
    }),
    findOne: jest.fn((q: any) => ({
      exec: async () =>
        store.find((r) => r.tokenHash === q.tokenHash && r.expiresAt > q.expiresAt.$gt) ?? null,
    })),
    deleteMany: jest.fn((q: any) => ({
      exec: async () => {
        for (let i = store.length - 1; i >= 0; i--) {
          if (!q.userId || store[i].userId === q.userId) store.splice(i, 1);
        }
        return { deletedCount: 0 };
      },
    })),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    toSafeUser: jest.Mock;
  };
  let rtModel: ReturnType<typeof makeRtModel>;
  let prModel: ReturnType<typeof makePrModel>;

  beforeEach(async () => {
    rtModel = makeRtModel();
    prModel = makePrModel();
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      toSafeUser: jest.fn((u: any) => ({
        id: u._id,
        email: u.email,
        name: u.name,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
    };

    // Onboarding collaborators + a transaction that just runs the callback.
    const workspaces = {
      createPersonal: jest.fn(async () => ({ _id: 'ws1' })),
    };
    const memberships = { create: jest.fn(async () => ({})) };
    const connection = {
      transaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) =>
        fn({} as unknown),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: WorkspacesService, useValue: workspaces },
        { provide: MembershipsService, useValue: memberships },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'access.jwt.token') } },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
        {
          provide: MailerService,
          useValue: { sendPasswordReset: jest.fn(), sendPasswordChanged: jest.fn() },
        },
        { provide: getConnectionToken(), useValue: connection },
        { provide: getModelToken(RefreshToken.name), useValue: rtModel },
        { provide: getModelToken(PasswordReset.name), useValue: prModel },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('signup hashes the password and never exposes it', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async (d: any) => ({
      _id: 'u1',
      email: d.email,
      name: d.name,
      passwordHash: d.passwordHash,
    }));

    const { auth, refreshToken } = await service.signup('a@b.com', 'password123', 'Ann');

    const created = users.create.mock.calls[0][0];
    expect(created.passwordHash).not.toBe('password123');
    await expect(argon2.verify(created.passwordHash, 'password123')).resolves.toBe(true);
    expect(auth.accessToken).toBe('access.jwt.token');
    expect((auth.user as any).passwordHash).toBeUndefined();
    expect(refreshToken).toBeTruthy();
    expect(JSON.stringify(auth)).not.toContain('password123');
  });

  it('signup rejects a duplicate email', async () => {
    users.findByEmail.mockResolvedValue({ _id: 'u1' });
    await expect(service.signup('a@b.com', 'password123', 'Ann')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login rejects unknown email and wrong password, accepts the right one', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(service.login('x@y.com', 'whatever1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const passwordHash = await argon2.hash('correct-password');
    users.findByEmail.mockResolvedValue({
      _id: 'u1',
      email: 'x@y.com',
      name: 'X',
      passwordHash,
    });
    await expect(service.login('x@y.com', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const ok = await service.login('x@y.com', 'correct-password');
    expect(ok.auth.accessToken).toBe('access.jwt.token');
    expect(ok.refreshToken).toBeTruthy();
  });

  it('refresh rotates the token: the old one stops working, the new one works', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async (d: any) => ({
      _id: 'u1',
      email: d.email,
      name: d.name,
      passwordHash: d.passwordHash,
    }));

    const { refreshToken: first } = await service.signup('a@b.com', 'password123', 'Ann');
    const r1 = await service.refresh(first);
    expect(r1.refreshToken).not.toBe(first);

    await expect(service.refresh(first)).rejects.toBeInstanceOf(UnauthorizedException);

    const r2 = await service.refresh(r1.refreshToken);
    expect(r2.refreshToken).not.toBe(r1.refreshToken);
  });

  it('logout invalidates the refresh token', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async (d: any) => ({
      _id: 'u1',
      email: d.email,
      name: d.name,
      passwordHash: d.passwordHash,
    }));

    const { refreshToken } = await service.signup('a@b.com', 'password123', 'Ann');
    await service.logout(refreshToken);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('changePassword rejects a wrong current password', async () => {
    const passwordHash = await argon2.hash('old-password');
    users.findById.mockResolvedValue({ _id: 'u1', email: 'a@b.com', passwordHash, save: jest.fn() });
    await expect(service.changePassword('u1', 'wrong', 'new-password1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('changePassword sets the new hash, revokes other sessions, issues a fresh one', async () => {
    const passwordHash = await argon2.hash('old-password');
    const doc: any = { _id: 'u1', email: 'a@b.com', name: 'A', passwordHash, save: jest.fn() };
    users.findById.mockResolvedValue(doc);
    // a stale session that must be revoked
    rtModel.store.push({ _id: 'old', userId: 'u1', tokenHash: 'x', expiresAt: new Date(Date.now() + 1e9) });

    const { auth, refreshToken } = await service.changePassword('u1', 'old-password', 'new-password1');

    await expect(argon2.verify(doc.passwordHash, 'new-password1')).resolves.toBe(true);
    expect(doc.save).toHaveBeenCalled();
    expect(rtModel.store.some((r) => r._id === 'old')).toBe(false); // revoked
    expect(refreshToken).toBeTruthy();
    expect(auth.accessToken).toBe('access.jwt.token');
  });

  it('resetPassword rejects an invalid token', async () => {
    await expect(service.resetPassword('nope', 'new-password1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('forgotPassword stays silent for an unknown email (no token created)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await service.forgotPassword('ghost@nowhere.com');
    expect(prModel.store).toHaveLength(0);
  });
});
