import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './refresh-token.schema';

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
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    toSafeUser: jest.Mock;
  };
  let rtModel: ReturnType<typeof makeRtModel>;

  beforeEach(async () => {
    rtModel = makeRtModel();
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      toSafeUser: jest.fn((u: any) => ({
        id: u._id,
        email: u.email,
        name: u.name,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'access.jwt.token') } },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
        { provide: getModelToken(RefreshToken.name), useValue: rtModel },
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
});
