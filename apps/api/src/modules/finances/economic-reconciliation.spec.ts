import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { EconomicReconciliationQueryDto } from './dto/economic-finances.dto';
import { listEconomicReconciliation } from './economic-reconciliation';

function fixture(rows: unknown[] = []) {
  const operation = { count: jest.fn().mockResolvedValue(rows.length), findMany: jest.fn().mockResolvedValue(rows) };
  const transaction = jest.fn(async work => work({ economicOperation: operation }));
  const db = { $transaction: transaction } as unknown as Parameters<typeof listEconomicReconciliation>[0];
  return { db, operation, transaction };
}
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'operation-a', kind: 'CAPTURE', state: 'SUCCEEDED', provenance: 'TEST', currency: 'USD',
    amountMinor: 9007199254740993n, provider: 'STRIPE', providerReference: 'pi_synthetic',
    createdAt: new Date('2026-10-07T00:00:00Z'), dispatchedAt: null, reconcileAfter: null, completedAt: null,
    context: { orderId: 'order-a', minorExponent: 2, order: { orderNumber: 'EZH-fixture' } },
    capture: null, refundRequest: null, ...overrides,
  };
}

describe('economic reconciliation read model', () => {
  it('defaults to unresolved LIVE USD operations in a consistent, bounded snapshot', async () => {
    const { db, operation, transaction } = fixture();
    const result = await listEconomicReconciliation(db, new EconomicReconciliationQueryDto());
    const where = { provenance: 'LIVE', currency: 'USD', state: { in: ['DISPATCHED', 'NEEDS_RECONCILIATION'] } };
    expect(operation.count).toHaveBeenCalledWith({ where });
    expect(operation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 20, skip: 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    expect(result).toMatchObject({ readOnly: true, version: 'economic-v1', data: [], total: 0 });
  });
  it('combines provenance, store, order and exact reference filters without broadening scope', async () => {
    const { db, operation } = fixture();
    await listEconomicReconciliation(db, Object.assign(new EconomicReconciliationQueryDto(), {
      provenance: 'TEST', kind: 'REFUND', state: 'PREPARED', storeId: 'store-a', orderId: 'order-a',
      reference: 'reference-a', page: 2, limit: 10,
    }));
    const where = { provenance: 'TEST', currency: 'USD', state: 'PREPARED', kind: 'REFUND',
      context: { orderId: 'order-a', order: { storeOrders: { some: { storeId: 'store-a' } } } },
      OR: [{ id: 'reference-a' }, { providerReference: 'reference-a' }, { context: { order: { orderNumber: 'reference-a' } } }],
    };
    expect(operation.count).toHaveBeenCalledWith({ where });
    expect(operation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 10, skip: 10 }));
  });
  it('does not infer capture proof from SUCCEEDED state or turn unknown differences into zero', async () => {
    const { db } = fixture([row()]);
    const result = await listEconomicReconciliation(db, new EconomicReconciliationQueryDto());
    expect(result.data[0]).toMatchObject({ state: 'SUCCEEDED', expectedMinor: '9007199254740993',
      verifiedMinor: null, differenceMinor: null, verifiedAt: null, evidenceStatus: 'NOT_VERIFIED' });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
  it('reports verified capture differences using exact minor units and selects no payment secrets', async () => {
    const { db, operation } = fixture([row({ capture: { id: 'capture-a', amountMinor: 9007199254741000n,
      verifiedAt: new Date('2026-10-07T00:01:00Z') }, providerPayload: { secret: 'must-not-expose' } })]);
    const result = await listEconomicReconciliation(db, new EconomicReconciliationQueryDto());
    expect(result.data[0]).toMatchObject({ verifiedMinor: '9007199254741000', differenceMinor: '7',
      evidenceStatus: 'CAPTURE_VERIFIED', captureId: 'capture-a' });
    const selection = operation.findMany.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty('providerPayload');
    expect(selection).not.toHaveProperty('providerAccount');
    expect(selection.context.select.order.select).toEqual({ orderNumber: true });
    expect(JSON.stringify(result)).not.toContain('must-not-expose');
  });
  it('a refund request links its original capture without presenting it as refund evidence', async () => {
    const refundRequest = { id: 'refund-a', captureId: 'original-capture', requestedBy: 'admin-a', reason: 'Approved return',
      createdAt: new Date('2026-10-07T00:02:00Z'), platformRoundingMinor: -2n };
    const { db } = fixture([row({ kind: 'REFUND', refundRequest })]);
    const result = await listEconomicReconciliation(db, new EconomicReconciliationQueryDto());
    expect(result.data[0]).toMatchObject({ captureId: 'original-capture', refundRequest: { ...refundRequest, platformRoundingMinor: '-2' },
      verifiedMinor: null, evidenceStatus: 'NOT_VERIFIED' });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
  it('reports immutable refund proof rather than the original captured amount', async () => {
    const { db } = fixture([row({ kind: 'REFUND', amountMinor: 35n, refundRequest: {
      id: 'refund-a', captureId: 'original-capture', requestedBy: 'operator', reason: 'Original return',
      createdAt: new Date(), platformRoundingMinor: -1n,
      settlement: { id: 'settlement', amountMinor: 35n, verifiedAt: new Date('2026-10-08T00:00:00Z') },
    } })]);
    const result = await listEconomicReconciliation(db, new EconomicReconciliationQueryDto());
    expect(result.data[0]).toMatchObject({ evidenceStatus: 'REFUND_VERIFIED', verifiedMinor: '35', differenceMinor: '0',
      captureId: 'original-capture', verifiedAt: new Date('2026-10-08T00:00:00Z') });
    expect(result.data[0].refundRequest).not.toHaveProperty('settlement');
  });
});
