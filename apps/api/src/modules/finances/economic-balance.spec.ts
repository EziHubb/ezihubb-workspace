import { EconomicPayout, PrismaClient } from '@prisma/client';
import { economicBalanceDto, economicTransaction, minorDecimal, readEconomicBalance, rejectEconomicPayout, reserveEconomicPayout } from './economic-balance';
import { buildEconomicQuote } from './economic-quote';
import { verifyAndSettleEconomicPayout, verifyTransferEvidence } from './economic-transfer';

const scope = { kind: 'SELLER' as const, beneficiaryId: 'store', currency: 'USD', provenance: 'TEST' as const };
const now = new Date('2026-10-04T00:00:00Z');
function harness() {
  const quote = buildEconomicQuote({ orderId: 'order', currency: 'USD', minorExponent: 2,
    stores: [{ storeId: 'store', storeOrderId: 'shop', lines: [{ id: 'line', productId: 'product', variantId: null,
      quantity: 1, unitPriceMinor: '1000', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
    customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
    affiliate: { id: 'affiliate', rate: '0.10', lockDays: 14, commissionMinor: '100', ruleReference: 'snapshot' },
    tax: { amountMinor: '0', ruleReference: 'synthetic' } });
  const account = { id: 'account', ...scope, minorExponent: 2, debtMinor: 0n, holdReason: null as string | null };
  const order = { status: 'CONFIRMED', adminArchivedAt: null, payment: { status: 'PAID' },
    storeOrders: [{ storeId: 'store', status: 'CONFIRMED', deliveredAt: null as Date | null }] };
  const context = { order, quote, operations: [] as unknown[] };
  const lots = [{ id: 'lot-a', accountId: account.id, amountMinor: 600n, reservedMinor: 0n, paidMinor: 0n,
    eligibleAt: new Date('2026-10-01'), holdReason: null as string | null, capture: { context } },
  { id: 'lot-b', accountId: account.id, amountMinor: 400n, reservedMinor: 0n, paidMinor: 0n,
    eligibleAt: new Date('2026-10-01'), holdReason: null as string | null, capture: { context } }];
  const payouts: EconomicPayout[] = [];
  const allocations: Array<{ payoutId: string; lotId: string; amountMinor: bigint }> = [];
  const updateLot = ({ where, data }: { where: { id: string }; data: { reservedMinor?: { increment?: bigint; decrement?: bigint }; paidMinor?: { increment?: bigint; decrement?: bigint } } }) => {
    const lot = lots.find(row => row.id === where.id);
    if (!lot) throw new Error('Missing fixture lot');
    for (const name of ['reservedMinor', 'paidMinor'] as const) {
      if (data[name]?.increment) lot[name] += data[name].increment;
      if (data[name]?.decrement) lot[name] -= data[name].decrement;
    }
    return lot;
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    economicBalanceAccount: { findUnique: jest.fn(async () => account) },
    economicBalanceLot: { findMany: jest.fn(async () => lots), update: jest.fn(async args => updateLot(args)),
      updateMany: jest.fn(async args => { updateLot(args); return { count: 1 }; }) },
    economicPayout: {
      findUnique: jest.fn(async ({ where }) => payouts.find(row => row.idempotencyKey === where.accountId_idempotencyKey.idempotencyKey) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        const payout = payouts.find(row => row.id === where.id);
        if (!payout) throw new Error('Missing fixture payout');
        return { ...payout, account, allocations: allocations.filter(row => row.payoutId === where.id) };
      }),
      create: jest.fn(async ({ data }) => { const payout = { ...data, id: `payout-${payouts.length}`, state: 'REQUESTED' } as EconomicPayout; payouts.push(payout); return payout; }),
      updateMany: jest.fn(async ({ where, data }) => {
        const payout = payouts.find(row => row.id === where.id && row.state === where.state);
        if (!payout) return { count: 0 }; Object.assign(payout, data); return { count: 1 };
      }),
    },
    economicPayoutAllocation: { create: jest.fn(async ({ data }) => { allocations.push(data); return data; }) },
  };
  // A serialized DB model, not proof of real PostgreSQL multi-session contention.
  let queue = Promise.resolve();
  const db = { ...tx, $transaction: jest.fn(work => {
    const task = queue.then(async () => {
      const beforeLots = lots.map(row => ({ ...row })), beforePayouts = payouts.map(row => ({ ...row })), beforeAllocations = [...allocations];
      try { return await work(tx); } catch (error) {
        lots.splice(0, lots.length, ...beforeLots); payouts.splice(0, payouts.length, ...beforePayouts); allocations.splice(0, allocations.length, ...beforeAllocations); throw error;
      }
    });
    queue = task.then(() => undefined, () => undefined);
    return task;
  }) };
  return { account, order, context, lots, payouts, allocations, tx, database: db as unknown as PrismaClient };
}
const request = (key: string, amount = '300') => ({ scope, actorId: 'owner', destination: 'acct_recipient', idempotencyKey: key, amountMinor: amount, minimumMinor: 1n });

describe('captured balance and exact payout contracts (modeled DB)', () => {
  it('separates available, pending, held, reserved, paid and debt without floating-point money', async () => {
    const h = harness(); h.account.debtMinor = 50n; h.lots[0].reservedMinor = 100n; h.lots[0].paidMinor = 200n; h.lots[1].holdReason = 'review';
    const balance = await readEconomicBalance(h.tx as never, scope, now);
    expect(economicBalanceDto(balance, scope)).toMatchObject({ capturedMinor: '1000', availableMinor: '250', heldMinor: '400', reservedMinor: '100', paidMinor: '200', debtMinor: '50' });
    expect(minorDecimal(9007199254740993n, 2)).toBe('90071992547409.93');
  });
  it.each(['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'])('holds %s orders instead of making their money withdrawable', async status => {
    const h = harness(); h.order.status = status;
    const balance = await readEconomicBalance(h.tx as never, scope, now);
    expect(balance.available).toBe(0n); expect(balance.held).toBe(1000n);
  });
  it('holds missing/unpaid payment, pending refunds and account restrictions', async () => {
    for (const reason of ['payment', 'refund', 'account'] as const) {
      const h = harness();
      if (reason === 'payment') h.order.payment.status = 'PENDING';
      if (reason === 'refund') h.context.operations.push({ kind: 'REFUND' });
      if (reason === 'account') h.account.holdReason = 'reconciliation';
      expect((await readEconomicBalance(h.tx as never, scope, now)).available).toBe(0n);
    }
  });
  it('uses delivery and snapshotted affiliate lock, not current mutable settings', async () => {
    const h = harness(), affiliateScope = { ...scope, kind: 'AFFILIATE' as const, beneficiaryId: 'affiliate' };
    expect((await readEconomicBalance(h.tx as never, affiliateScope, now)).pending).toBe(1000n);
    h.order.storeOrders[0].status = 'DELIVERED'; h.order.storeOrders[0].deliveredAt = new Date('2026-09-21');
    expect((await readEconomicBalance(h.tx as never, affiliateScope, now)).available).toBe(0n);
    expect((await readEconomicBalance(h.tx as never, affiliateScope, new Date('2026-10-05'))).available).toBe(1000n);
  });
  it('allocates partial amounts FIFO, deduplicates replay and rejects altered idempotency payload', async () => {
    const h = harness(); const first = await reserveEconomicPayout(h.database, request('first', '700'));
    expect(h.allocations.map(row => row.amountMinor)).toEqual([600n, 100n]);
    expect((await reserveEconomicPayout(h.database, request('first', '700'))).id).toBe(first.id);
    expect(h.allocations).toHaveLength(2);
    await expect(reserveEconomicPayout(h.database, request('first', '600'))).rejects.toThrow('different details');
  });
  it('two competing payout requests cannot reserve more than modeled available funds', async () => {
    const h = harness(); const results = await Promise.allSettled([
      reserveEconomicPayout(h.database, request('first', '700')), reserveEconomicPayout(h.database, request('second', '700')),
    ]);
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(h.lots.reduce((sum, lot) => sum + lot.reservedMinor, 0n)).toBe(700n);
  });
  it('reject releases only its own allocation; foreign account and repeat reject cannot mutate it', async () => {
    const h = harness(); const first = await reserveEconomicPayout(h.database, request('first')); await reserveEconomicPayout(h.database, request('second', '200'));
    await expect(rejectEconomicPayout(h.database, first.id, 'operator', 'reason', { ...scope, beneficiaryId: 'foreign' })).rejects.toThrow('does not belong');
    await rejectEconomicPayout(h.database, first.id, 'operator', 'reason', scope);
    expect(h.lots[0].reservedMinor).toBe(200n);
    await expect(rejectEconomicPayout(h.database, first.id, 'operator', 'reason', scope)).rejects.toThrow('terminal');
  });
  const reader = (id: string) => ({ provider: 'STRIPE' as const, providerAccount: 'acct_platform', provenance: 'TEST' as const,
    read: jest.fn(async () => ({ id: 'tr_fixture', livemode: false, amount: 300, currency: 'usd', destination: 'acct_recipient',
      reversed: false, amount_reversed: 0, balance_transaction: 'txn_fixture', metadata: { economicPayoutId: id } })) });
  it('settles only reserved parts, records identity and replay does not double-debit', async () => {
    const h = harness(); const payout = await reserveEconomicPayout(h.database, request('first'));
    await reserveEconomicPayout(h.database, request('second', '200'));
    const evidence = reader(payout.id);
    await verifyAndSettleEconomicPayout(h.database, payout.id, 'operator', 'tr_fixture', evidence, scope);
    expect(h.lots[0]).toMatchObject({ paidMinor: 300n, reservedMinor: 200n });
    expect(h.payouts[0]).toMatchObject({ state: 'PAID', transferReference: 'tr_fixture', processedBy: 'operator', verificationStartedBy: 'operator' });
    await verifyAndSettleEconomicPayout(h.database, payout.id, 'operator', 'tr_fixture', evidence, scope);
    expect(h.lots[0].paidMinor).toBe(300n);
  });
  it('provider timeout keeps funds reserved and prevents reject/changed reference; same-reference read can recover', async () => {
    const h = harness(); const payout = await reserveEconomicPayout(h.database, request('first')); const evidence = reader(payout.id);
    evidence.read.mockRejectedValueOnce(new Error('synthetic timeout'));
    await expect(verifyAndSettleEconomicPayout(h.database, payout.id, 'operator', 'tr_fixture', evidence, scope)).rejects.toThrow('timeout');
    expect(h.payouts[0].state).toBe('VERIFYING'); expect(h.lots[0].reservedMinor).toBe(300n);
    await expect(rejectEconomicPayout(h.database, payout.id, 'operator', 'reason', scope)).rejects.toThrow();
    await expect(verifyAndSettleEconomicPayout(h.database, payout.id, 'operator', 'tr_other', evidence, scope)).rejects.toThrow('already bound');
    await verifyAndSettleEconomicPayout(h.database, payout.id, 'operator', 'tr_fixture', evidence, scope);
    expect(h.payouts[0].state).toBe('PAID');
  });
  it('only retries bounded database serialization failures', async () => {
    const db = { $transaction: jest.fn().mockRejectedValueOnce({ code: 'P2034' }).mockResolvedValueOnce('ok') };
    expect(await economicTransaction(db as never, jest.fn())).toBe('ok'); expect(db.$transaction).toHaveBeenCalledTimes(2);
    db.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(economicTransaction(db as never, jest.fn())).rejects.toEqual({ code: 'P2034' });
    expect(db.$transaction).toHaveBeenCalledTimes(5);
  });
});

describe('transfer evidence does not trust mark-paid input', () => {
  const expected = { payoutId: 'payout', provider: 'PAYPAL' as const, providerAccount: 'merchant', provenance: 'TEST' as const,
    transferReference: 'ITEM', destination: 'recipient@example.test', amountMinor: '300', currency: 'USD', minorExponent: 2 };
  const paypal = { payout_item_id: 'ITEM', transaction_status: 'SUCCESS', transaction_id: 'TRANSACTION',
    payout_item: { receiver: 'recipient@example.test', sender_item_id: 'payout', amount: { currency: 'USD', value: '3.00' } } };
  it('requires successful exact recipient, payout metadata, amount and currency', () => {
    expect(verifyTransferEvidence(paypal, expected)).toMatch(/^[a-f0-9]{64}$/);
    for (const change of [{ transaction_status: 'PENDING' }, { transaction_id: '' }, { payout_item: { ...paypal.payout_item, receiver: 'foreign' } },
      { payout_item: { ...paypal.payout_item, amount: { currency: 'EUR', value: '3.00' } } }]) {
      expect(() => verifyTransferEvidence({ ...paypal, ...change }, expected)).toThrow('reconciliation');
    }
  });
});
