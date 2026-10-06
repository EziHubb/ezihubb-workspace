import { EconomicInventoryReservation, Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_STOCK_RESERVATION_TTL_SECONDS, ECONOMIC_POLICY_VERSION } from '../finances/economic-policy';
import { inventoryPools } from './inventory-policy';

type Database = Pick<PrismaClient, '$transaction'>;
const MAX_QUANTITY = 2147483647;

/** Dormant: caller must gate ONLINE checkout or audited manual acceptance. */
export async function reserveEconomicInventory(
  db: Database, contextId: string, now = new Date(), ttlSeconds = DEFAULT_STOCK_RESERVATION_TTL_SECONDS,
) {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 86400) {
    throw new Error('Reservation TTL must be 1–86400 seconds');
  }
  return db.$transaction(async tx => {
    const context = await tx.economicOrderContext.findUniqueOrThrow({
      where: { id: contextId },
      include: { order: { include: { items: { include: {
        product: { select: { id: true, quantity: true, trackInventory: true, variationSettings: {
          select: { enableVariations: true, variesBy: true },
        } } },
        variant: { select: { id: true, productId: true, quantity: true, isAvailable: true } },
      } } } } },
    });
    if (context.policyVersion !== ECONOMIC_POLICY_VERSION) throw new Error('Unsupported inventory policy');
    const existing = await tx.economicInventoryReservation.findMany({ where: { contextId }, orderBy: { poolKey: 'asc' } });
    // Never recompute pools, extend TTL or reserve again when this context replays.
    if (existing.length) return existing;
    const pools = inventoryPools(context.order.items);
    if (!pools.length) throw new Error('Cannot reserve an empty order');
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const created = await tx.economicInventoryReservation.createMany({
      data: pools.map(pool => ({ ...pool, contextId, expiresAt, createdAt: now })), skipDuplicates: true,
    });
    // A same-context race at SERIALIZABLE can instead raise P2034. Caller retries
    // this DB-only transaction, never an external payment, with the same context.
    if (created.count === 0) {
      return tx.economicInventoryReservation.findMany({ where: { contextId }, orderBy: { poolKey: 'asc' } });
    }
    if (created.count !== pools.length) throw new Error('Incomplete inventory reservation set');
    for (const pool of pools) {
      if (pool.target === 'UNLIMITED') continue;
      if (pool.target === 'VARIANT' && !pool.variantId) throw new Error('Missing variant inventory target');
      const changed = pool.target === 'VARIANT'
        ? await tx.productVariant.updateMany({
          where: { id: pool.variantId ?? '', productId: pool.productId, isAvailable: true, quantity: { gte: pool.quantity } },
          data: { quantity: { decrement: pool.quantity } },
        })
        : await tx.product.updateMany({
          where: { id: pool.productId, quantity: { gte: pool.quantity } },
          data: { quantity: { decrement: pool.quantity } },
        });
      if (changed.count !== 1) throw new Error('Insufficient inventory; reservation rolled back');
    }
    return tx.economicInventoryReservation.findMany({ where: { contextId }, orderBy: { poolKey: 'asc' } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Caller passes the capture/receipt transaction; consumption itself never debits stock again. */
export async function consumeHeldInventory(tx: Prisma.TransactionClient, contextId: string, now = new Date()) {
  const reservations = await tx.economicInventoryReservation.findMany({ where: { contextId }, orderBy: { poolKey: 'asc' } });
  if (!reservations.length) throw new Error('Capture has no inventory reservation');
  for (const reservation of reservations) {
    if (reservation.state === 'CONSUMED') continue;
    const changed = await tx.economicInventoryReservation.updateMany({
      where: { id: reservation.id, state: 'HELD', expiresAt: { gt: now } },
      data: { state: 'CONSUMED', consumedAt: now },
    });
    if (changed.count !== 1) throw new Error('Late or released capture requires stock reconciliation before fulfillment');
  }
}

async function restoreSnapshotPool(tx: Prisma.TransactionClient, reservation: EconomicInventoryReservation) {
  if (reservation.target === 'UNLIMITED') return;
  if (reservation.target === 'VARIANT' && !reservation.variantId) throw new Error('Missing original variant inventory target');
  // Null/missing/replaced pools must not silently lose a release, or wrap Int32.
  const quantity = { gte: 0, lte: MAX_QUANTITY - reservation.quantity };
  const result = reservation.target === 'VARIANT'
    ? await tx.productVariant.updateMany({
      where: { id: reservation.variantId ?? '', productId: reservation.productId, quantity },
      data: { quantity: { increment: reservation.quantity } },
    })
    : await tx.product.updateMany({
      where: { id: reservation.productId, quantity }, data: { quantity: { increment: reservation.quantity } },
    });
  if (result.count !== 1) throw new Error('Original inventory pool unavailable; release requires reconciliation');
}

export async function releaseEconomicInventory(
  db: Database, contextId: string, reason: 'CANCELLED' | 'EXPIRED', now = new Date(),
) {
  return db.$transaction(async tx => {
    const rows = await tx.economicInventoryReservation.findMany({
      where: { contextId, state: 'HELD', ...(reason === 'EXPIRED' ? { expiresAt: { lte: now } } : {}) },
      orderBy: { poolKey: 'asc' },
    });
    for (const row of rows) {
      const claimed = await tx.economicInventoryReservation.updateMany({
        where: { id: row.id, state: 'HELD', ...(reason === 'EXPIRED' ? { expiresAt: { lte: now } } : {}) },
        data: { state: reason === 'EXPIRED' ? 'EXPIRED' : 'RELEASED', releasedAt: now },
      });
      if (claimed.count === 1) await restoreSnapshotPool(tx, row);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
