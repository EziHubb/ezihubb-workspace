import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { SenderType } from '@prisma/client';
import { GuestMessageAccessService } from './guest-message-access.service';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
jest.mock('./link-preview.service', () => ({ LinkPreviewService: class {} }));
jest.mock('../moderation/moderation.service', () => ({ ModerationService: class {} }));
jest.mock('../../common/services/storage.service', () => ({ StorageService: class {} }));
jest.mock('../realtime/realtime.gateway', () => ({ RealtimeGateway: class {} }));
jest.mock('../notifications/notifications.service', () => ({ NotificationsService: class {} }));
jest.mock('../notifications/push.service', () => ({ PushService: class {} }));

function proofFixture() {
  const row = { id: 'ABCDEF123456', email: 'buyer@example.test', verificationHash: null as string | null,
    tokenHash: null as string | null, verifiedAt: null as Date | null, revokedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 900000), attempts: 0 };
  const model = {
    create: jest.fn(async () => ({ ...row })),
    update: jest.fn(async ({ data }) => { Object.assign(row, data); return { ...row }; }),
    findUnique: jest.fn(async () => ({ ...row })),
    findFirst: jest.fn(async ({ where }) => row.tokenHash === where.tokenHash && row.verifiedAt && !row.revokedAt && row.expiresAt > new Date() ? { email: row.email } : null),
    updateMany: jest.fn(async ({ where, data }) => {
      if ((where.id && where.id !== row.id) || (where.tokenHash && where.tokenHash !== row.tokenHash) ||
        (where.verifiedAt === null && row.verifiedAt) || (where.revokedAt === null && row.revokedAt) ||
        (where.expiresAt && row.expiresAt <= where.expiresAt.gt) || (where.attempts && row.attempts >= where.attempts.lt) ||
        (where.verificationHash && row.verificationHash !== where.verificationHash)) return { count: 0 };
      if (data.attempts) row.attempts += data.attempts.increment;
      else Object.assign(row, data);
      return { count: 1 };
    }),
  };
  const queue = { add: jest.fn().mockResolvedValue({ id: 'job' }) };
  const redis = { incrementSecurityCounter: jest.fn().mockResolvedValue(1) };
  const service = new GuestMessageAccessService({ guestMessageAccess: model } as never, redis as never,
    { get: (key: string) => key === 'app.env' ? 'production' : undefined } as never, queue as never);
  const res = { cookie: jest.fn(), setHeader: jest.fn(), clearCookie: jest.fn() };
  async function request() {
    const result = await service.requestProof(row.email);
    const code = queue.add.mock.calls[0][1].data.code as string;
    return { ...result, code };
  }
  return { service, row, model, queue, redis, res, request };
}

describe('Guest mailbox proof and session capability', () => {
  it('sends proof through email, stores only its salted hash and returns no credential', async () => {
    const { service, row, model, queue } = proofFixture();
    const result = await service.requestProof(' Buyer@Example.Test ');
    expect(model.create).toHaveBeenCalledWith({ data: { email: 'buyer@example.test', expiresAt: expect.any(Date) } });
    const code = queue.add.mock.calls[0][1].data.code;
    expect(row.verificationHash).toBe(createHash('sha256').update(`${row.id}:${code}`).digest('hex'));
    expect(result).toEqual({ challengeId: row.id, expiresIn: 900 });
    expect(JSON.stringify(result)).not.toContain(code);
  });
  it('revokes undeliverable proof instead of claiming delivery succeeded', async () => {
    const { service, row, queue } = proofFixture();
    queue.add.mockRejectedValueOnce(new Error('private provider detail'));
    await expect(service.requestProof(row.email)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(row.revokedAt).toBeInstanceOf(Date); expect(row.verificationHash).toBeNull();
  });
  it('rate limits per mailbox and fails closed on Redis outage', async () => {
    const { service, redis, model, row } = proofFixture();
    redis.incrementSecurityCounter.mockResolvedValueOnce(4);
    await expect(service.requestProof(row.email)).rejects.toBeInstanceOf(UnauthorizedException);
    redis.incrementSecurityCounter.mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(service.requestProof(row.email)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(model.create).not.toHaveBeenCalled();
  });
  it('consumes proof only once under competing valid submissions and sets an HttpOnly scoped cookie', async () => {
    const { service, row, request, res } = proofFixture();
    const { challengeId, code } = await request();
    const results = await Promise.allSettled([service.verifyProof(challengeId, code, res as never), service.verifyProof(challengeId, code, res as never)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [name, rawToken, options] = res.cookie.mock.calls[0];
    expect(name).toBe('guest_message_access');
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/v1/messages', maxAge: 86400000 });
    expect(row.tokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(row.verificationHash).toBeNull();
  });
  it('locks proof after five bad guesses, including a later correct code', async () => {
    const { service, request, row, res } = proofFixture();
    const { challengeId, code } = await request();
    for (let i = 0; i < 5; i++) await expect(service.verifyProof(challengeId, '00000000', res as never)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyProof(challengeId, code, res as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(row.attempts).toBe(5); expect(res.cookie).not.toHaveBeenCalled();
  });
  it('rejects expired proofs and expired/revoked capabilities', async () => {
    const { service, request, row, res } = proofFixture();
    const { challengeId, code } = await request();
    row.expiresAt = new Date(0);
    await expect(service.verifyProof(challengeId, code, res as never)).rejects.toBeInstanceOf(UnauthorizedException);
    row.expiresAt = new Date(Date.now() + 60000);
    await service.verifyProof(challengeId, code, res as never);
    const req = { cookies: { guest_message_access: res.cookie.mock.calls[0][1] } };
    await expect(service.resolveEmail(req as never)).resolves.toBe(row.email);
    row.expiresAt = new Date(0);
    await expect(service.resolveEmail(req as never)).resolves.toBeUndefined();
    row.expiresAt = new Date(Date.now() + 60000);
    await service.revoke(req as never, res as never);
    await expect(service.resolveEmail(req as never)).resolves.toBeUndefined();
    expect(res.clearCookie).toHaveBeenCalled();
  });
  it('does not query a missing or malformed capability', async () => {
    const { service, model } = proofFixture();
    for (const token of [undefined, '', 'email@example.test', {}, ['token']]) {
      await expect(service.resolveEmail({ cookies: { guest_message_access: token } } as never)).resolves.toBeUndefined();
    }
    expect(model.findFirst).not.toHaveBeenCalled();
  });
});

function conversationFixture(userId: string | null = null) {
  const conversation = { id: 'c', storeId: 'shop', userId, guestEmail: 'buyer@example.test', messages: [] };
  const prisma = { conversation: { findUnique: jest.fn().mockResolvedValue(conversation), findMany: jest.fn(), update: jest.fn() },
    message: { create: jest.fn() }, order: { findFirst: jest.fn().mockResolvedValue(null) } };
  const service = Object.create(MessagesService.prototype) as MessagesService;
  Object.assign(service, { prisma });
  return { service, prisma, conversation };
}

describe('Guest conversation access boundaries', () => {
  it.each([undefined, 'other@example.test'])('ID knowledge or wrong mailbox cannot read/write/page/upload/report/hide: %s', async (email) => {
    const { service, prisma } = conversationFixture();
    const viewer = { userId: null, forShop: false, verifiedGuestEmail: email };
    const actions = [() => service.getConversation('c', null, email),
      () => service.sendMessage('c', SenderType.CUSTOMER, null, { body: 'attempt' }, undefined, email),
      () => service.assertThreadAccess('c', viewer), // gate also used by link-preview
      () => service.getMessagePage('c', {} as never, viewer),
      () => service.uploadAttachments('c', [], viewer),
      () => service.hideForBuyer('c', null, email),
      () => service.reportConversation('c', null, 'SPAM' as never, undefined, email)];
    for (const action of actions) await expect(action()).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
  it('allows matching verified mailbox but never uses it to enter an account-owned thread', async () => {
    const { service } = conversationFixture();
    await expect(service.getConversation('c', null, 'buyer@example.test')).resolves.toMatchObject({ id: 'c' });
    const owned = conversationFixture('owner').service;
    await expect(owned.getConversation('c', null, 'buyer@example.test')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(owned.getConversation('c', 'other', 'buyer@example.test')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(owned.getConversation('c', 'owner')).resolves.toMatchObject({ id: 'c' });
  });
  it('does not start/reopen a thread just from an email, or associate an unowned order', async () => {
    const { service, prisma } = conversationFixture();
    await expect(service.createConversation(null, { guestEmail: 'buyer@example.test', body: 'hi' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createConversation(null, { guestEmail: 'buyer@example.test', body: 'hi', orderId: 'foreign' }, 'buyer@example.test')).rejects.toThrow('Order not found');
    expect(prisma.order.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', userId: null, guestEmail: 'buyer@example.test' }, select: { id: true } });
  });
  it('keeps shop isolation and requires proof to list anonymous conversations', async () => {
    const { service, prisma } = conversationFixture();
    await expect(service.assertThreadAccess('c', { forShop: true, storeId: 'different' })).rejects.toThrow();
    await expect(service.getGuestConversations()).rejects.toBeInstanceOf(ForbiddenException);
    await service.getGuestConversations('buyer@example.test');
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: null, guestEmail: 'buyer@example.test', hiddenByCustomerAt: null } }));
  });
  it('does not expose even the caller\'s own order context to an unrelated shop', async () => {
    const { service, prisma } = conversationFixture();
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'owned' } as never);
    const storeOrder = { findMany: jest.fn().mockResolvedValue([]) };
    Object.assign(prisma, { storeOrder });
    await expect(service.createConversation(null, { guestEmail: 'buyer@example.test', body: 'hi', orderId: 'owned', storeId: 'foreign-shop' }, 'buyer@example.test')).rejects.toThrow('Shop order not found');
    expect(storeOrder.findMany).toHaveBeenCalledWith({ where: { orderId: 'owned', storeId: 'foreign-shop' }, select: { storeId: true }, take: 2 });
  });
});

describe('Guest controller trusted identity propagation', () => {
  it('uses cookie resolution rather than a forged query or body identity', async () => {
    const messages = { getConversation: jest.fn(), sendMessage: jest.fn(), assertThreadAccess: jest.fn(), markCustomerRead: jest.fn() };
    const access = { resolveEmail: jest.fn().mockResolvedValue('verified@example.test') };
    const controller = new MessagesController(messages as never, {} as never, access as never);
    const req = { query: { verifiedGuestEmail: 'victim@example.test' }, body: { verifiedGuestEmail: 'victim@example.test' }, cookies: { guest_message_access: 'opaque-token' } };
    await controller.getConversation('c', undefined, req as never);
    expect(messages.getConversation).toHaveBeenCalledWith('c', null, 'verified@example.test');
    await controller.sendMessage('c', { body: 'hello' }, undefined, req as never);
    expect(messages.sendMessage).toHaveBeenCalledWith('c', SenderType.CUSTOMER, null, { body: 'hello' }, undefined, 'verified@example.test');
    await controller.markRead('c', undefined, req as never);
    expect(messages.assertThreadAccess).toHaveBeenCalledWith('c', { userId: null, forShop: false, verifiedGuestEmail: 'verified@example.test' });
    expect(messages.markCustomerRead).toHaveBeenCalledWith('c');
    messages.assertThreadAccess.mockRejectedValueOnce(new ForbiddenException());
    await expect(controller.markRead('forbidden', undefined, req as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.markCustomerRead).toHaveBeenCalledTimes(1);
  });
  it('does not let a guest cookie override an authenticated identity', async () => {
    const messages = { getConversation: jest.fn() };
    const access = { resolveEmail: jest.fn() };
    const controller = new MessagesController(messages as never, {} as never, access as never);
    await controller.getConversation('c', { sub: 'owner' } as never, {} as never);
    expect(access.resolveEmail).not.toHaveBeenCalled();
    expect(messages.getConversation).toHaveBeenCalledWith('c', 'owner', undefined);
  });
});
