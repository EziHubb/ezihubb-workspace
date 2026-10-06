import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
jest.mock('./totp.service', () => ({ TotpService: class {} }));
jest.mock('../messages/messages.service', () => ({ MessagesService: class {} }));
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hash'), compare: jest.fn().mockResolvedValue(true) }));

function fixture() {
  const user = { id: 'u', email: 'owner@example.test', role: 'ADMIN', passwordHash: 'hash', isEmailVerified: false, totpEnabled: false };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), create: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ ...user, isEmailVerified: true }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    emailVerification: { findFirst: jest.fn().mockResolvedValue({ id: 'v', userId: 'u' }), update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const messages = { linkGuestConversations: jest.fn().mockResolvedValue(undefined) };
  const service = Object.create(AuthService.prototype) as AuthService;
  const totpService = { verifyToken: jest.fn().mockResolvedValue(true), generateBackupCodes: () => ['code'],
    hashBackupCodes: async () => ['hash'], encryptSecret: () => 'encrypted' };
  const redis = { getSecurityCounter: jest.fn().mockResolvedValue(0), clearSecurityCounter: jest.fn().mockResolvedValue(undefined),
    incrementSecurityCounter: jest.fn().mockResolvedValue(1), claimSecurityToken: jest.fn().mockResolvedValue(true) };
  Object.assign(service, { prisma, messages, totpService, redis,
    logger: { log: jest.fn(), error: jest.fn() }, enqueueVerificationEmail: jest.fn().mockResolvedValue(undefined),
    signPartialToken: () => 'challenge', setRefreshTokenCookie: jest.fn() });
  jest.spyOn(service, 'generateTokens').mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  return { service, prisma, messages, user, redis };
}

describe('Identity hardening invariants', () => {
  it('Google callback transports only a challenge fragment when MFA is pending', async () => {
    const controller = Object.create(AuthController.prototype) as AuthController;
    Object.assign(controller, { authService: { googleLogin: async () => ({ requiresTOTP: true, partialToken: 'pending-token' }) },
      config: { get: () => 'https://shop.example.test' } });
    const res = { redirect: jest.fn(), setHeader: jest.fn() };
    await controller.googleCallback({} as never, res as never);
    expect(res.redirect).toHaveBeenCalledWith('https://shop.example.test/auth/google/callback#partialToken=pending-token');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it('Google ID-token endpoint returns 202 challenge, not a completed session', async () => {
    const controller = Object.create(AuthController.prototype) as AuthController;
    Object.assign(controller, { authService: { googleTokenLogin: async () => ({ requiresTOTP: true, partialToken: 'pending-token' }) } });
    const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() }; res.status.mockReturnValue(res);
    await controller.googleTokenLogin({ credential: 'google-token' }, res as never);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { requiresTOTP: true, partialToken: 'pending-token' }, meta: null });
  });
  it('does not check a password or issue a session if the security backend is unavailable', async () => {
    const { service, prisma, redis } = fixture();
    redis.getSecurityCounter.mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(service.login({ email: 'owner@example.test', password: 'password' }, {} as never)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(service.generateTokens).not.toHaveBeenCalled();
  });
  it('blocks a locked account and records failures through the atomic security counter', async () => {
    const { service, prisma, redis } = fixture();
    redis.getSecurityCounter.mockResolvedValueOnce(5);
    await expect(service.login({ email: 'owner@example.test', password: 'password' }, {} as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    prisma.user.findUnique.mockResolvedValueOnce(null as never);
    await expect(service.login({ email: 'owner@example.test', password: 'password' }, {} as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.incrementSecurityCounter).toHaveBeenCalledWith('auth:login:owner@example.test', 900);
  });
  it.each(['totp-pending', 'password-reset', 'unknown'])('rejects %s at HTTP access validation', async (purpose) => {
    const prisma = { user: { findUnique: jest.fn() } };
    const strategy = new JwtStrategy({ get: () => 'test-secret' } as unknown as ConfigService, prisma as unknown as PrismaService);
    await expect(strategy.validate({ sub: 'u', email: 'a@example.test', role: 'ADMIN', purpose })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
  it('rejects an old privileged role despite an active session', async () => {
    const prisma = { user: { findUnique: async () => ({ role: 'CUSTOMER', authSessions: [{ id: 's' }] }) } };
    const strategy = new JwtStrategy({ get: () => 'test-secret' } as unknown as ConfigService, prisma as unknown as PrismaService);
    await expect(strategy.validate({ sub: 'u', email: 'a@example.test', role: 'SUPER_ADMIN', sid: 's' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('registration never claims guest history', async () => {
    const { service, prisma, messages } = fixture();
    prisma.user.findUnique.mockResolvedValue(null as never);
    await service.register({ email: 'owner@example.test', password: 'password', firstName: 'Test', lastName: 'User' }, {} as never);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(messages.linkGuestConversations).not.toHaveBeenCalled();
  });
  it.each([false, true])('password login links only verified mailboxes: verified=%s', async (verified) => {
    const { service, user, prisma, messages } = fixture();
    user.isEmailVerified = verified;
    await service.login({ email: user.email, password: 'password' }, {} as never);
    expect(prisma.order.updateMany).toHaveBeenCalledTimes(verified ? 1 : 0);
    expect(messages.linkGuestConversations).toHaveBeenCalledTimes(verified ? 1 : 0);
  });
  it.each(['ADMIN', 'SUPER_ADMIN', 'CUSTOMER'])('does not link history or bypass enabled MFA for %s', async (role) => {
    const { service, user, prisma } = fixture();
    user.isEmailVerified = true; user.totpEnabled = true; user.role = role;
    await expect(service.login({ email: user.email, password: 'password' }, {} as never)).resolves.toEqual({ requiresTOTP: true, partialToken: 'challenge' });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(service.generateTokens).not.toHaveBeenCalled();
  });
  it.each(['googleLogin', 'googleTokenLogin'] as const)('%s requires local MFA and does not link guest history early', async (method) => {
    const { service, user, prisma, messages } = fixture();
    user.totpEnabled = true;
    const profile = { googleId: 'google', email: user.email, emailVerified: true, firstName: 'Test', lastName: 'User', avatarUrl: null };
    prisma.user.update.mockResolvedValueOnce({ ...user, providerId: 'google', isEmailVerified: true } as never);
    Object.assign(service, { verifyGoogleIdToken: async () => profile });
    const result = method === 'googleLogin'
      ? await service.googleLogin(profile, {} as never) : await service.googleTokenLogin('google-token', {} as never);
    expect(result).toEqual({ requiresTOTP: true, partialToken: 'challenge' });
    expect(service.generateTokens).not.toHaveBeenCalled();
    expect(messages.linkGuestConversations).not.toHaveBeenCalled();
  });
  it('a valid MFA challenge can issue a session only once', async () => {
    const { service, user, redis } = fixture();
    Object.assign(user, { totpEnabled: true, totpSecret: 'encrypted', backupCodes: [] });
    Object.assign(service, { config: { get: () => 'test' },
      jwtService: { verify: () => ({ sub: user.id, role: user.role, purpose: 'totp-pending', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 }) },
      totpService: { decryptSecret: () => 'secret', verifyToken: async () => true },
    });
    redis.claimSecurityToken.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await service.verifyTotp('partial', '123456', {} as never);
    await expect(service.verifyTotp('partial', '123456', {} as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.generateTokens).toHaveBeenCalledTimes(1);
  });
  it('links history after successful mailbox verification', async () => {
    const { service, prisma, messages } = fixture();
    await service.verifyEmail('verification-token');
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { guestEmail: 'owner@example.test', userId: null }, data: { userId: 'u' } });
    expect(messages.linkGuestConversations).toHaveBeenCalledWith('u', 'owner@example.test');
  });
  it.each([undefined, null, '', ' ', {}, []])('rejects a missing/malformed verification token before any DB query: %j', async (token) => {
    const { service, prisma, messages } = fixture();
    await expect(service.verifyEmail(token as string)).rejects.toThrow();
    expect(prisma.emailVerification.findFirst).not.toHaveBeenCalled();
    expect(messages.linkGuestConversations).not.toHaveBeenCalled();
  });
  it('does not link anything when verification DB transaction fails', async () => {
    const { service, prisma, messages } = fixture();
    prisma.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.verifyEmail('verification-token')).rejects.toThrow();
    expect(messages.linkGuestConversations).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
  it('cannot replace an enabled factor or win a competing setup', async () => {
    const { service, prisma } = fixture();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.confirmTotp('u', 'attacker-secret', '123456')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u', totpEnabled: false, deletedAt: null } }));
  });
});
