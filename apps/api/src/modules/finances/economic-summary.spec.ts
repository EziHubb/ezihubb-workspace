import { Prisma, PrismaClient } from '@prisma/client';
import { readEconomicSummary } from './economic-summary';
import { legacyOrderSql, legacyOrderWhere, legacyPaymentWhere, legacyStoreOrderWhere } from './finance-reporting-scope';

function fixture() {
  const tx = {
    economicCapture: { aggregate: jest.fn(async () => ({ _sum: { amountMinor: 9007199254740993n }, _count: 2 })) },
    economicRefund: { aggregate: jest.fn(async () => ({ _sum: { amountMinor: 100n }, _count: 1 })) },
    economicPayout: { aggregate: jest.fn(async () => ({ _sum: { amountMinor: 60n }, _count: 1 })) },
    economicBalanceAccount: { aggregate: jest.fn(async () => ({ _sum: { debtMinor: 40n } })) },
    economicDebtRecovery: { aggregate: jest.fn(async () => ({ _sum: { amountMinor: 20n } })) },
    economicRefundJournalEntry: { aggregate: jest.fn(async () => ({ _sum: { amountMinor: -1n } })) },
    economicConsumerReceipt: { count: jest.fn(async () => 2) }, economicExternalEffect: { count: jest.fn(async () => 1) },
  };
  const $transaction = jest.fn(async work => work(tx));
  return { tx, $transaction, db: { $transaction } as unknown as PrismaClient };
}
describe('separate versioned financial evidence summary', () => {
  it.each(['LIVE', 'TEST'] as const)('scopes every source to %s / USD with exact amounts and one snapshot', async provenance => {
    const { db, tx, $transaction } = fixture(), scope = { currency: 'USD', provenance };
    expect(await readEconomicSummary(db, scope)).toMatchObject({
      provenance, basis: 'IMMUTABLE_VERIFIED_EVIDENCE', legacyIncluded: false, readOnly: true,
      capturedMinor: '9007199254740993', refundedMinor: '100', netCollectedMinor: '9007199254740893',
      paidOutMinor: '60', outstandingDebtMinor: '40', recoveredDebtMinor: '20', bookedRefundRoundingMinor: '-1',
      actualProviderFeeMinor: null, actualShippingCostMinor: null,
      downstream: { lifecycleAppliedCount: 2, notificationProjectionCount: 2, podVerifiedCount: 1, externalUnknownCount: 1, smtpAcceptedCount: 1,
        smtpBasis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' },
    });
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(tx.economicCapture.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
    expect(tx.economicRefund.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { request: { capture: scope } } }));
    expect(tx.economicPayout.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { account: scope, state: 'PAID' } }));
    expect(tx.economicBalanceAccount.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
    expect(tx.economicDebtRecovery.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { lot: { account: scope } } }));
    expect(tx.economicRefundJournalEntry.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: {
      currency: 'USD', account: 'PLATFORM_ROUNDING', refund: { request: { capture: scope } },
    } }));
    expect(tx.economicConsumerReceipt.count).toHaveBeenCalledWith({ where: { consumer: 'notifications.v1', event: { context: scope } } });
    expect(tx.economicExternalEffect.count).toHaveBeenCalledWith({ where: { kind: 'POD_PRINTIFY', state: 'SUCCEEDED', context: scope } });
  });
  it('does not turn query errors or a broken conservation invariant into zero funds', async () => {
    const { db, tx } = fixture();
    tx.economicCapture.aggregate.mockRejectedValueOnce(new Error('Synthetic offline'));
    await expect(readEconomicSummary(db, { currency: 'USD', provenance: 'TEST' })).rejects.toThrow('offline');
    tx.economicRefund.aggregate.mockResolvedValueOnce({ _sum: { amountMinor: 9007199254740994n }, _count: 1 });
    await expect(readEconomicSummary(db, { currency: 'USD', provenance: 'TEST' })).rejects.toThrow('exceed captures');
  });
  it('keeps existing store, date, status and search predicates inside non-overridable legacy filters', () => {
    const order = { storeOrders: { some: { storeId: 'own-store' } }, OR: [{ orderNumber: 'one' }, { orderNumber: 'two' }] };
    expect(legacyOrderWhere(order)).toEqual({ AND: [order, { economicContext: { is: null } }] });
    const payment = { status: 'PAID' as const, order: { id: 'original-order' } };
    expect(legacyPaymentWhere(payment)).toEqual({ AND: [payment, { order: legacyOrderWhere() }] });
    const shop = { storeId: 'own-store', createdAt: { gte: new Date(0) } };
    expect(legacyStoreOrderWhere(shop)).toEqual({ AND: [shop, { order: legacyOrderWhere() }] });
    expect(legacyOrderSql(Prisma.sql`so."orderId"`).text).toContain('"EconomicOrderContext" finance_scope');
    expect(legacyOrderSql(Prisma.sql`so."orderId"`).text).toContain('finance_scope."orderId" = so."orderId"');
  });
});
