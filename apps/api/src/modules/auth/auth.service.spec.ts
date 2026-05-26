import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

jest.mock('bcrypt');
const bcryptMocked = bcrypt as jest.Mocked<typeof bcrypt>;

const mockUser = {
  id: 'user-cuid-001',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  passwordHash: '$2b$12$existing_hash',
  role: 'CUSTOMER',
  avatarUrl: null,
  isEmailVerified: false,
  provider: null,
  providerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRes: any = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let redis: DeepMockProxy<RedisService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: RedisService, useValue: mockDeep<RedisService>() },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.access.token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, string> = {
                'jwt.accessSecret':    'test-access-secret',
                'jwt.accessExpiresIn': '15m',
                'app.env':             'test',
              };
              return cfg[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma  = module.get(PrismaService);
    redis   = module.get(RedisService);

    // Defaults: no lock, operations succeed
    redis.get.mockResolvedValue(null);
    redis.del.mockResolvedValue(undefined);
    redis.increment.mockResolvedValue(1);
    redis.getClient.mockReturnValue({ expire: jest.fn().mockResolvedValue(1) } as any);

    prisma.refreshToken.create.mockResolvedValue({} as any);
    prisma.emailVerification.create.mockResolvedValue({} as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user, enqueues verification email, returns accessToken', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcryptMocked.hash as jest.Mock).mockResolvedValue('$2b$12$hashed_new');
      prisma.user.create.mockResolvedValue(mockUser as any);

      const result = await service.register(
        { email: 'jane@example.com', password: 'StrongPass1!', firstName: 'Jane', lastName: 'Doe' },
        mockRes,
      );

      expect(result.accessToken).toBe('signed.access.token');
      expect(result.user.email).toBe('jane@example.com');
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('throws ConflictException with ERR_EMAIL_TAKEN when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        service.register(
          { email: 'jane@example.com', password: 'StrongPass1!', firstName: 'Jane', lastName: 'Doe' },
          mockRes,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken and clears the failed-attempt counter on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcryptMocked.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'jane@example.com', password: 'StrongPass1!' }, mockRes);

      expect(result.accessToken).toBe('signed.access.token');
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('jane@example.com'));
    });

    it('increments failed-attempt counter and throws UnauthorizedException on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcryptMocked.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'jane@example.com', password: 'WrongPass' }, mockRes),
      ).rejects.toThrow(UnauthorizedException);

      expect(redis.increment).toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('throws ERR_ACCOUNT_LOCKED without touching the DB when attempt count >= 5', async () => {
      redis.get.mockResolvedValue(5 as any);

      await expect(
        service.login({ email: 'jane@example.com', password: 'AnyPass' }, mockRes),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_ACCOUNT_LOCKED' }),
        }),
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when user does not exist (same error to avoid enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'Pass' }, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refreshTokens ──────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    const storedToken = {
      id:         'rt-001',
      userId:     'user-cuid-001',
      tokenHash:  'any-hash',
      revokedAt:  null,
      expiresAt:  new Date(Date.now() + 86_400_000),
      user:       { email: 'jane@example.com', role: 'CUSTOMER' },
    };

    it('revokes the old token and issues a new accessToken', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(storedToken as any);
      prisma.refreshToken.update.mockResolvedValue({} as any);

      const result = await service.refreshTokens('user-cuid-001', 'raw-refresh-token', mockRes);

      expect(result.accessToken).toBe('signed.access.token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws UnauthorizedException when token is not found or has expired', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-cuid-001', 'expired-token', mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for already-used (revoked) tokens — they are filtered out by the query', async () => {
      // The query includes `revokedAt: null`, so used tokens return null
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-cuid-001', 'already-used-token', mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('creates a passwordReset record when the user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.passwordReset.create.mockResolvedValue({} as any);

      await service.forgotPassword('jane@example.com');

      expect(prisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: mockUser.id }),
        }),
      );
    });

    it('returns undefined silently when user does not exist (prevents email enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword('ghost@example.com')).resolves.toBeUndefined();
      expect(prisma.passwordReset.create).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const resetRecord = {
      id:        'pr-001',
      userId:    'user-cuid-001',
      token:     'valid-reset-token',
      usedAt:    null,
      expiresAt: new Date(Date.now() + 3_600_000),
    };

    it('hashes new password and runs $transaction to update user + revoke tokens', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue(resetRecord as any);
      (bcryptMocked.hash as jest.Mock).mockResolvedValue('$2b$12$new_hash');
      prisma.$transaction.mockImplementation(async (ops: any) => Promise.all(ops));
      prisma.passwordReset.update.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as any);

      await service.resetPassword('valid-reset-token', 'NewStrongPass1!');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(bcryptMocked.hash).toHaveBeenCalledWith('NewStrongPass1!', 12);
    });

    it('throws BadRequestException with ERR_RESET_TOKEN_INVALID for expired or used tokens', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('stale-token', 'Pass1!')).rejects.toThrow(BadRequestException);
    });
  });
});
