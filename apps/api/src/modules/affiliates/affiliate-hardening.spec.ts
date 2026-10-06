import { CommissionService } from './commission.service';
import { PortalService } from './portal.service';
import { AdminAffiliatesService } from './admin-affiliates.service';

// In-memory transactional harness proves branch/order invariants, NOT PostgreSQL
// isolation. Real DB concurrent transactions remain a required sandbox drill.
function fixture() {
  const record = { id: 'c', orderId: 'o', affiliateId: 'a', amount: 20, status: 'PENDING', order: { orderNumber: 'test' }, affiliate: { email: 'test@example.test' } };
  const prisma = {
    affiliateCommission: { findUnique: jest.fn(async () => ({ ...record })), updateMany: jest.fn(async ({ where, data }) => {
      if (where.status !== record.status) return { count: 0 };
      record.status = data.status; return { count: 1 };
    }) },
    affiliateSettings: { findUnique: jest.fn().mockResolvedValue({ minPayoutAmount: 10 }) },
    affiliateAccount: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue({ balance: 100, status: 'ACTIVE' }), updateMany: jest.fn() },
    affiliatePayout: { create: jest.fn().mockResolvedValue({ id: 'p' }), findUnique: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(prisma)),
  };
  const deps = { prisma, config: { get: () => 'https://example.test' }, logger: { log: jest.fn(), warn: jest.fn() }, emailQueue: { add: jest.fn().mockResolvedValue({}) }, queue: { getJob: jest.fn().mockResolvedValue(null) } };
  function service<T>(prototype: object): T { return Object.assign(Object.create(prototype), deps); }
  return { prisma, record, service };
}

describe('Affiliate economic transition guards', () => {
  it('two competing confirmations credit only once', async () => {
    const { prisma, service } = fixture();
    const commissions = service<CommissionService>(CommissionService.prototype);
    await Promise.all([commissions.confirmCommission('o'), commissions.confirmCommission('o')]);
    expect(prisma.affiliateAccount.update).toHaveBeenCalledTimes(1);
    expect(prisma.affiliateAccount.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { balance: { increment: 20 }, totalEarned: { increment: 20 } } });
  });
  it('duplicate cancellation reverses once; concurrent loser does not debit again', async () => {
    const { prisma, record, service } = fixture();
    record.status = 'CONFIRMED';
    const commissions = service<CommissionService>(CommissionService.prototype);
    await Promise.allSettled([commissions.cancelCommission('o', 'cancel'), commissions.cancelCommission('o', 'cancel')]);
    await commissions.cancelCommission('o', 'cancel');
    expect(prisma.affiliateAccount.update).toHaveBeenCalledTimes(1);
    expect(record.status).toBe('CANCELLED');
  });
  it('a stale cancellation cannot skip reversal after competing confirmation', async () => {
    const { prisma, service } = fixture();
    prisma.affiliateCommission.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service<CommissionService>(CommissionService.prototype).cancelCommission('o', 'cancel')).rejects.toThrow('retry cancellation');
    expect(prisma.affiliateAccount.update).not.toHaveBeenCalled();
  });
  it('reserves balance atomically; stale balance read cannot create a second payout', async () => {
    const { prisma, service } = fixture();
    let balance = 100;
    prisma.affiliateAccount.updateMany.mockImplementation(async ({ where, data }) => {
      if (balance < where.balance.gte) return { count: 0 };
      balance -= data.balance.decrement; return { count: 1 };
    });
    const portal = service<PortalService>(PortalService.prototype);
    const dto = { amount: 80, paymentMethod: 'paypal', paymentDetail: 'test@example.test' };
    const results = await Promise.allSettled([portal.requestPayout('a', dto), portal.requestPayout('a', dto)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(balance).toBe(20);
    expect(prisma.affiliatePayout.create).toHaveBeenCalledTimes(1);
    expect(prisma.affiliateAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a', status: 'ACTIVE', balance: { gte: 80 } } }));
  });
  it('a rejected or concurrently paid payout cannot re-credit the reservation', async () => {
    const { prisma, service } = fixture();
    prisma.affiliatePayout.findUnique.mockResolvedValue({ id: 'p', affiliateId: 'a', amount: 80, status: 'REQUESTED' });
    prisma.affiliatePayout.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const admin = service<AdminAffiliatesService>(AdminAffiliatesService.prototype);
    await admin.rejectPayout('p', { reason: 'test' }, 'admin');
    await expect(admin.rejectPayout('p', { reason: 'test' }, 'admin')).rejects.toThrow();
    expect(prisma.affiliateAccount.update).toHaveBeenCalledTimes(1);
  });
  it('does not mark commissions paid after losing payout transition', async () => {
    const { prisma, service } = fixture();
    prisma.affiliatePayout.findUnique.mockResolvedValue({ id: 'p', status: 'REQUESTED' });
    prisma.affiliatePayout.updateMany.mockResolvedValue({ count: 0 });
    await expect(service<AdminAffiliatesService>(AdminAffiliatesService.prototype).markPayoutPaid('p', {}, 'admin')).rejects.toThrow();
    expect(prisma.affiliateCommission.updateMany).not.toHaveBeenCalled();
  });
});
