import { Prisma, PrismaClient } from '@prisma/client';
import { consumeCapturedInventory, consumeHeldInventory, releaseEconomicInventory, reserveEconomicInventory } from './inventory-reservation';
import { ECONOMIC_POLICY_VERSION } from '../finances/economic-policy';

const now = new Date('2026-10-03T00:00:00Z');
const product = { id: 'product1', quantity: 10, trackInventory: true, variationSettings: null };
const context = { id: 'context1', policyVersion: ECONOMIC_POLICY_VERSION, order: { items: [
  { id: 'line1', quantity: 2, product, variant: null },
  { id: 'line2', quantity: 3, product, variant: null },
] } };
const reservation = { id: 'reservation1', contextId: 'context1', productId: 'product1', variantId: null,
  poolKey: 'PRODUCT:product1', target: 'PRODUCT', quantity: 5, state: 'HELD',
  expiresAt: new Date(now.getTime() + 900_000), lines: [{ id: 'line1', quantity: 2 }, { id: 'line2', quantity: 3 }],
};

function harness() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    economicCapture: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'capture', contextId: context.id,
      context: { ...context, order: { status: 'PENDING_PAYMENT', adminArchivedAt: null } } }) },
    economicInventoryReacquisition: { create: jest.fn().mockResolvedValue({ id: 'reacquisition' }) },
    economicOrderContext: { findUniqueOrThrow: jest.fn().mockResolvedValue(context) },
    economicInventoryReservation: {
      findMany: jest.fn().mockResolvedValue([reservation]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const transaction = tx as unknown as Prisma.TransactionClient;
  const db = { $transaction: jest.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>, _options?: unknown) => fn(transaction)) };
  return { tx, transaction, db, database: db as unknown as PrismaClient };
}

describe('dormant inventory reservation DB contracts (not real contention)', () => {
  it('reacquires the original released pool without extending or resetting the reservation', async () => {
    const h=harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([{...reservation,state:'EXPIRED',reacquisition:null}] as never);
    await consumeCapturedInventory(h.transaction,'capture',new Date(now.getTime()+900_001));
    expect(h.tx.product.updateMany).toHaveBeenCalledWith({where:{id:product.id,quantity:{gte:5}},data:{quantity:{decrement:5}}});
    expect(h.tx.economicInventoryReservation.updateMany).not.toHaveBeenCalled();
    expect(h.tx.economicInventoryReacquisition.create).toHaveBeenCalledWith({data:{reservationId:reservation.id,captureId:'capture',quantity:5}});
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([{...reservation,state:'EXPIRED',reacquisition:{captureId:'capture'}}] as never);
    h.tx.product.updateMany.mockClear();h.tx.economicInventoryReacquisition.create.mockClear();
    await consumeCapturedInventory(h.transaction,'capture');
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();expect(h.tx.economicInventoryReacquisition.create).not.toHaveBeenCalled();
  });
  it('blocks late capture without stock, cancelled orders, foreign proof and missing reservations',async()=>{
    const h=harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([{...reservation,state:'RELEASED',reacquisition:null}] as never);
    h.tx.product.updateMany.mockResolvedValue({count:0});
    await expect(consumeCapturedInventory(h.transaction,'capture')).rejects.toThrow('stock unavailable');
    expect(h.tx.economicInventoryReacquisition.create).not.toHaveBeenCalled();
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([{...reservation,state:'RELEASED',reacquisition:{captureId:'foreign'}}] as never);
    await expect(consumeCapturedInventory(h.transaction,'capture')).rejects.toThrow('Foreign');
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([]);
    await expect(consumeCapturedInventory(h.transaction,'capture')).rejects.toThrow('no inventory reservation');
    h.tx.economicCapture.findUniqueOrThrow.mockResolvedValue({id:'capture',contextId:context.id,context:{...context,order:{status:'CANCELLED',adminArchivedAt:null}}});
    await expect(consumeCapturedInventory(h.transaction,'capture')).rejects.toThrow('reconciliation before fulfillment');
  });
  it('reserves the complete shared-pool quantity once with a finite-stock predicate and default TTL', async () => {
    const h = harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValueOnce([]);
    await reserveEconomicInventory(h.database, context.id, now);
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(h.tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: product.id, quantity: { gte: 5 } }, data: { quantity: { decrement: 5 } },
    });
    expect(h.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(h.tx.economicInventoryReservation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ contextId: context.id, target: 'PRODUCT', quantity: 5,
        expiresAt: new Date(now.getTime() + 900_000) })], skipDuplicates: true,
    });
  });

  it('returns snapshotted reservations on retry without extending TTL or decrementing again', async () => {
    const h = harness();
    expect(await reserveEconomicInventory(h.database, context.id, now, 1800)).toEqual([reservation]);
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
    expect(h.tx.economicInventoryReservation.createMany).not.toHaveBeenCalled();
  });

  it('a same-context insert loser never decrements inventory', async () => {
    const h = harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValueOnce([]);
    h.tx.economicInventoryReservation.createMany.mockResolvedValue({ count: 0 });
    expect(await reserveEconomicInventory(h.database, context.id, now)).toEqual([reservation]);
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('bubbles insufficient stock out of the transaction, never commits a partial reservation', async () => {
    const h = harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValueOnce([]);
    h.tx.product.updateMany.mockResolvedValue({ count: 0 });
    let committed = false;
    h.db.$transaction.mockImplementation(async fn => {
      const result = await fn(h.transaction);
      committed = true;
      return result;
    });
    await expect(reserveEconomicInventory(h.database, context.id, now)).rejects.toThrow('Insufficient inventory');
    expect(committed).toBe(false);
  });

  it('reserves unlimited products with a receipt but no inventory decrement', async () => {
    const h = harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValueOnce([]);
    h.tx.economicOrderContext.findUniqueOrThrow.mockResolvedValue({ ...context, order: { items: [
      { id: 'line1', quantity: 2, product: { ...product, trackInventory: false, quantity: null }, variant: null },
    ] } });
    await reserveEconomicInventory(h.database, context.id, now);
    expect(h.tx.economicInventoryReservation.createMany).toHaveBeenCalled();
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
    expect(h.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it('only debits selected variant stock when settings enable per-variant quantities', async () => {
    const h = harness();
    h.tx.economicInventoryReservation.findMany.mockResolvedValueOnce([]);
    h.tx.economicOrderContext.findUniqueOrThrow.mockResolvedValue({ ...context, order: { items: [
      { id: 'line1', quantity: 2, product: { ...product,
        variationSettings: { enableVariations: true, variesBy: ['quantity'] } },
      variant: { id: 'variant1', productId: product.id, quantity: 5, isAvailable: true } },
    ] } });
    await reserveEconomicInventory(h.database, context.id, now);
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
    expect(h.tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'variant1', productId: product.id, isAvailable: true, quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    });
  });

  it('uses a conditional consume transition and does not debit inventory a second time', async () => {
    const h = harness();
    await consumeHeldInventory(h.transaction, context.id, now);
    expect(h.tx.economicInventoryReservation.updateMany).toHaveBeenCalledWith({
      where: { id: reservation.id, state: 'HELD', expiresAt: { gt: now } },
      data: { state: 'CONSUMED', consumedAt: now },
    });
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
    h.tx.economicInventoryReservation.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeHeldInventory(h.transaction, context.id, now)).rejects.toThrow('reconciliation before fulfillment');
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([{ ...reservation, state: 'CONSUMED' }]);
    await expect(consumeHeldInventory(h.transaction, context.id, now)).resolves.toBeUndefined();
  });

  it('releases a snapshotted pool only after winning the HELD transition, not from current settings', async () => {
    const h = harness();
    await releaseEconomicInventory(h.database, context.id, 'EXPIRED', now);
    expect(h.tx.economicInventoryReservation.updateMany).toHaveBeenCalledWith({
      where: { id: reservation.id, state: 'HELD', expiresAt: { lte: now } },
      data: { state: 'EXPIRED', releasedAt: now },
    });
    expect(h.tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: product.id, quantity: { gte: 0, lte: 2147483642 } }, data: { quantity: { increment: 5 } },
    });
    expect(h.tx.economicOrderContext.findUniqueOrThrow).not.toHaveBeenCalled();
    h.tx.product.updateMany.mockClear();
    h.tx.economicInventoryReservation.updateMany.mockResolvedValue({ count: 0 });
    await releaseEconomicInventory(h.database, context.id, 'CANCELLED', now);
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('does not silently drop stock when the original pool was removed or set to null', async () => {
    const h = harness();
    h.tx.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(releaseEconomicInventory(h.database, context.id, 'CANCELLED', now))
      .rejects.toThrow('release requires reconciliation');
  });

  it('validates reservation TTL and rejects missing capture reservations', async () => {
    const h = harness();
    for (const ttl of [0, -1, 1.5, 86401]) {
      await expect(reserveEconomicInventory(h.database, context.id, now, ttl)).rejects.toThrow('TTL');
    }
    expect(h.db.$transaction).not.toHaveBeenCalled();
    h.tx.economicInventoryReservation.findMany.mockResolvedValue([]);
    await expect(consumeHeldInventory(h.transaction, context.id, now)).rejects.toThrow('no inventory reservation');
  });
});
