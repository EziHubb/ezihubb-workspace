// Mock otplib before any imports — it's an ESM-only package that can't be loaded by Jest/CJS
jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXP'),
  generateURI:    jest.fn(() => 'otpauth://totp/Daily Daisy%20Admin:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Daily Daisy%20Admin'),
  verify:         jest.fn(() => Promise.resolve({ valid: true })),
}));

import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { QUEUES } from '../../queue/queue.constants';

jest.mock('bcrypt');
const bcryptMocked = bcrypt as jest.Mocked<typeof bcrypt>;

const mockUser = {
  id:              'user-cuid-001',
  email:           'jane@example.com',
  firstName:       'Jane',
  lastName:        'Doe',
  passwordHash:    '$2b$12$existing_hash',
  role:            'CUSTOMER',
  avatarUrl:       null,
  isEmailVerified: false,
  provider:        null,
  providerId:      null,
  totpEnabled:     false,
  totpSecret:      null,
  totpVerifiedAt:  null,
  backupCodes:     [],
  createdAt:       new Date(),
  updatedAt:       new Date(),
};

const mockAdminUser = {
  ...mockUser,
  id:          'admin-cuid-001',
  email:       'admin@example.com',
  role:        'ADMIN',
  totpEnabled: false,
};

const mockRes: any = {
  cookie:      jest.fn(),
  clearCookie: jest.fn(),
};

const mockTotpService = {
  newSecret:          jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  otpAuthUri:         jest.fn().mockReturnValue('otpauth://totp/Daily Daisy%20Admin:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Daily Daisy%20Admin'),
  qrCodeDataUrl:      jest.fn().mockResolvedValue('data:image/png;base64,fakeqrcode'),
  generateBackupCodes: jest.fn().mockReturnValue(['AABB1122', 'CCDD3344', 'EEFF5566', 'GGHH7788', 'IIJJ9900', 'KKLL1122', 'MMNN3344', 'OOPP5566']),
  verifyToken:        jest.fn().mockResolvedValue(true),
  consumeBackupCode:  jest.fn().mockResolvedValue(null),
  hashBackupCodes:    jest.fn().mockImplementation((codes: string[]) => Promise.resolve(codes)),
  encryptSecret:      jest.fn().mockReturnValue('iv:encrypted'),
  decryptSecret:      jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma:  DeepMockProxy<PrismaService>;
  let redis:   DeepMockProxy<RedisService>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    jwtService = {
      sign:   jest.fn().mockReturnValue('signed.access.token'),
      verify: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService,  useValue: mockDeep<PrismaService>() },
        { provide: RedisService,   useValue: mockDeep<RedisService>() },
        { provide: JwtService,     useValue: jwtService },
        { provide: TotpService,    useValue: { ...mockTotpService } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, string> = {
                'jwt.accessSecret':    'test-access-secret',
                'jwt.accessExpiresIn': '15m',
                'app.env':             'test',
                'FRONTEND_URL':        'http://localhost:3000',
              };
              return cfg[key];
            }),
          },
        },
        {
          provide: getQueueToken(QUEUES.EMAIL),
          useValue: { add: jest.fn().mockResolvedValue({ id: '1' }) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma  = module.get(PrismaService);
    redis   = module.get(RedisService);

    // Defaults
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

      expect((result as any).accessToken).toBe('signed.access.token');
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

    it('throws ERR_ACCOUNT_LOCKED without touching DB when attempt count >= 5', async () => {
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

    it('throws UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'Pass' }, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns requiresTOTP:true + partialToken for ADMIN with totpEnabled=true', async () => {
      const adminWithTotp = { ...mockAdminUser, totpEnabled: true, totpSecret: 'iv:encrypted' };
      prisma.user.findUnique.mockResolvedValue(adminWithTotp as any);
      (bcryptMocked.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('partial.jwt.token');

      const result = await service.login({ email: 'admin@example.com', password: 'Pass' }, mockRes);

      expect((result as any).requiresTOTP).toBe(true);
      expect((result as any).partialToken).toBe('partial.jwt.token');
      // Should NOT set refresh token cookie yet
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('returns regular accessToken for ADMIN with totpEnabled=false', async () => {
      prisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      (bcryptMocked.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'admin@example.com', password: 'Pass' }, mockRes);

      expect((result as any).accessToken).toBe('signed.access.token');
      expect((result as any).requiresTOTP).toBeUndefined();
    });
  });

  // ── verifyTotp ────────────────────────────────────────────────────────────

  describe('verifyTotp', () => {
    const validPayload = {
      sub:     'admin-cuid-001',
      email:   'admin@example.com',
      role:    'ADMIN',
      purpose: 'totp-pending',
    };

    it('issues full tokens when TOTP code is valid', async () => {
      jwtService.verify.mockReturnValue(validPayload);
      const adminWithTotp = { ...mockAdminUser, totpEnabled: true, totpSecret: 'iv:encrypted', backupCodes: [] };
      prisma.user.findUnique.mockResolvedValue(adminWithTotp as any);
      // verifyToken (mocked on TotpService) returns true by default

      const result = await service.verifyTotp('partial.jwt.token', '123456', mockRes);

      expect(result.accessToken).toBe('signed.access.token');
      expect(mockRes.cookie).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.any(Object));
    });

    it('throws ERR_TOTP_TOKEN_INVALID when JWT is expired or malformed', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(
        service.verifyTotp('bad.token', '123456', mockRes),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_TOTP_TOKEN_INVALID' }),
        }),
      );
    });

    it('throws ERR_TOTP_TOKEN_INVALID when purpose claim is not totp-pending', async () => {
      jwtService.verify.mockReturnValue({ ...validPayload, purpose: 'access' });

      await expect(
        service.verifyTotp('regular.access.token', '123456', mockRes),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_TOTP_TOKEN_INVALID' }),
        }),
      );
    });

    it('throws ERR_TOTP_CODE_INVALID when code is wrong and no backup code matches', async () => {
      jwtService.verify.mockReturnValue(validPayload);
      const adminWithTotp = { ...mockAdminUser, totpEnabled: true, totpSecret: 'iv:encrypted', backupCodes: ['AABB1122'] };
      prisma.user.findUnique.mockResolvedValue(adminWithTotp as any);

      // Override the mock for this test to return false
      const totpSvc = service['totpService'] as any;
      totpSvc.verifyToken = jest.fn().mockResolvedValue(false);
      totpSvc.consumeBackupCode = jest.fn().mockResolvedValue(null);

      await expect(
        service.verifyTotp('partial.jwt.token', '000000', mockRes),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_TOTP_CODE_INVALID' }),
        }),
      );
    });

    it('accepts a valid backup code and removes it from the stored list', async () => {
      jwtService.verify.mockReturnValue(validPayload);
      const adminWithTotp = { ...mockAdminUser, totpEnabled: true, totpSecret: 'iv:encrypted', backupCodes: ['AABB1122'] };
      prisma.user.findUnique.mockResolvedValue(adminWithTotp as any);

      const totpSvc = service['totpService'] as any;
      totpSvc.verifyToken = jest.fn().mockResolvedValue(false); // TOTP code wrong
      totpSvc.consumeBackupCode = jest.fn().mockResolvedValue([]);  // backup code consumed

      prisma.user.update.mockResolvedValue({ ...adminWithTotp, backupCodes: [] } as any);

      const result = await service.verifyTotp('partial.jwt.token', 'AABB1122', mockRes);

      expect(result.accessToken).toBe('signed.access.token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ backupCodes: [] }) }),
      );
    });
  });

  // ── setupTotp ─────────────────────────────────────────────────────────────

  describe('setupTotp', () => {
    it('returns secret and QR code URL without saving to DB', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(mockAdminUser as any);

      const result = await service.setupTotp('admin-cuid-001');

      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── confirmTotp ───────────────────────────────────────────────────────────

  describe('confirmTotp', () => {
    it('saves encrypted secret + enables TOTP when code is valid', async () => {
      prisma.user.update.mockResolvedValue({ ...mockAdminUser, totpEnabled: true } as any);

      const result = await service.confirmTotp('admin-cuid-001', 'JBSWY3DPEHPK3PXP', '123456');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totpSecret:  'iv:encrypted',
            totpEnabled: true,
          }),
        }),
      );
      expect(result.backupCodes).toHaveLength(8);
    });

    it('throws BadRequestException when code is invalid', async () => {
      const totpSvc = service['totpService'] as any;
      totpSvc.verifyToken = jest.fn().mockResolvedValue(false);

      await expect(
        service.confirmTotp('admin-cuid-001', 'JBSWY3DPEHPK3PXP', '000000'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── refreshTokens ──────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    const storedToken = {
      id:        'rt-001',
      userId:    'user-cuid-001',
      tokenHash: 'any-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      user:      { email: 'jane@example.com', role: 'CUSTOMER' },
    };

    it('revokes old token and issues new accessToken', async () => {
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

    it('throws UnauthorizedException when token not found or expired', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-cuid-001', 'expired-token', mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('creates a passwordReset record when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.passwordReset.create.mockResolvedValue({} as any);

      await service.forgotPassword('jane@example.com');

      expect(prisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: mockUser.id }),
        }),
      );
    });

    it('returns silently when user does not exist (prevents enumeration)', async () => {
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

    it('hashes new password and updates user + revokes refresh tokens in transaction', async () => {
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

    it('throws BadRequestException for expired or used tokens', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('stale-token', 'Pass1!')).rejects.toThrow(BadRequestException);
    });
  });
});
