import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
jest.mock('./totp.service', () => ({ TotpService: class {} }));
jest.mock('../messages/messages.service', () => ({ MessagesService: class {} }));

// Models transactional rollback + atomic compare-and-set, not real PG locking.
function fixture() {
  let revoked = false;
  const stored = { id: 'old', user: { email: 'u@example.test', role: 'CUSTOMER', deletedAt: null, storeId: null },
    sessionId: 's', session: { revokedAt: null, expiresAt: new Date(Date.now() + 60000) }, expiresAt: new Date(Date.now() + 60000) };
  const tx = { refreshToken: {
    findFirst: jest.fn().mockResolvedValue(stored),
    updateMany: jest.fn(async () => { if (revoked) return { count: 0 }; revoked = true; return { count: 1 }; }),
    create: jest.fn().mockResolvedValue({}),
  }, authSession: { create: jest.fn().mockResolvedValue({ id: 'new-session' }) } };
  const prisma = { $transaction: jest.fn(async (callback: (db: unknown) => Promise<unknown>) => {
    let claimed = false;
    const connection = { ...tx, refreshToken: { ...tx.refreshToken, updateMany: async () => {
      const result = await tx.refreshToken.updateMany(); claimed = result.count === 1; return result;
    } } };
    try { return await callback(connection); } catch (err) { if (claimed) revoked = false; throw err; }
  }) };
  const service = Object.create(AuthService.prototype) as AuthService;
  const cookie = jest.fn();
  Object.assign(service, { prisma, config: { get: () => 'test-secret' }, jwtService: { sign: () => 'access' }, setRefreshTokenCookie: cookie });
  return { service, tx, stored, cookie, isRevoked: () => revoked };
}

describe('Refresh rotation', () => {
  it('permits exactly one successor when two requests read the same old token', async () => {
    const { service, tx, cookie, isRevoked } = fixture();
    const results = await Promise.allSettled([service.refreshTokens('u', 'old', {} as never), service.refreshTokens('u', 'old', {} as never)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(cookie).toHaveBeenCalledTimes(1);
    expect(isRevoked()).toBe(true);
    await expect(service.refreshTokens('u', 'old', {} as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rolls back consumption and sends no cookie when creating the successor fails', async () => {
    const { service, tx, cookie, isRevoked } = fixture();
    tx.refreshToken.create.mockRejectedValueOnce(new Error('DB failure'));
    await expect(service.refreshTokens('u', 'old', {} as never)).rejects.toThrow('DB failure');
    expect(isRevoked()).toBe(false);
    expect(cookie).not.toHaveBeenCalled();
    await expect(service.refreshTokens('u', 'old', {} as never)).resolves.toEqual({ accessToken: 'access' });
  });
  it('caps successor lifetime at the original session expiry', async () => {
    const { service, tx, stored } = fixture();
    await service.refreshTokens('u', 'old', {} as never);
    expect(tx.refreshToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sessionId: 's', expiresAt: stored.session.expiresAt }) });
  });
  it('rejects a deleted account before consuming the refresh token', async () => {
    const { service, tx } = fixture();
    tx.refreshToken.findFirst.mockResolvedValueOnce({ user: { deletedAt: new Date() } } as never);
    await expect(service.refreshTokens('u', 'old', {} as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
