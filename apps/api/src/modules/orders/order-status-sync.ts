import { OrderStatus, Prisma } from '@prisma/client';

/**
 * The fulfilment stages, least to most advanced.
 *
 * The money states are absent on purpose. PENDING_PAYMENT, CANCELLED,
 * REFUNDED, REFUND_REQUESTED and DISPUTED are decided elsewhere and outrank
 * anything a shop does with its own queue — an order that has been refunded
 * must never be dragged back into "in production" because a seller moved a
 * card.
 */
export const FULFILMENT_STAGES = [
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
] as const;

export type FulfilmentStage = (typeof FULFILMENT_STAGES)[number];

export function isFulfilmentStage(s: OrderStatus): s is FulfilmentStage {
  return (FULFILMENT_STAGES as readonly OrderStatus[]).includes(s);
}

/** Returns the least advanced shop milestone, or null for an incomplete view. */
export function leastAdvancedFulfilmentStatus(
  statuses: readonly OrderStatus[],
): FulfilmentStage | null {
  if (statuses.length === 0) return null;

  let rank = FULFILMENT_STAGES.length - 1;
  for (const status of statuses) {
    const index = (FULFILMENT_STAGES as readonly OrderStatus[]).indexOf(status);
    if (index < 0) return null;
    if (index < rank) rank = index;
  }

  return FULFILMENT_STAGES[rank];
}

/** A shop whose part is settled rather than still being worked. */
const SETTLED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

/**
 * Recomputes `Order.status` from the shops that make up the order.
 *
 * One rule, one place. An order is only as far along as its LEAST advanced
 * shop: a basket is not shipped until every shop in it has shipped, and it is
 * not complete until every shop is done. That last case is all this used to
 * do — it was `completeFinishedOrders`, which promoted to COMPLETED and
 * nothing else — so the buyer's status told them about completion and about
 * nothing in between.
 *
 * It demotes as well as promotes, and that is deliberate rather than
 * incidental: a seller who reopens work on a completed order has made the
 * order genuinely incomplete again, and the buyer's review and download
 * access — both gated on COMPLETED — should follow the truth rather than the
 * high-water mark.
 *
 * Shops that are cancelled or refunded do not hold the order back; they are
 * settled, just not by delivery. If every part is settled there is nothing to
 * derive and the order is left alone for whatever closed it to own.
 */
export async function syncOrderStatusFromShops(
  tx: Prisma.TransactionClient,
  orderIds: string[],
  history?: { note?: string | null; createdBy?: string },
): Promise<void> {
  for (const orderId of [...new Set(orderIds)]) {
    const order = await tx.order.findUnique({
      where:  { id: orderId },
      select: { status: true },
    });
    if (!order || !isFulfilmentStage(order.status)) continue;

    const shops = await tx.storeOrder.findMany({
      where:  { orderId, status: { notIn: SETTLED } },
      select: { status: true },
    });
    if (shops.length === 0) continue;

    // A shop sitting on something this cannot rank — PENDING_PAYMENT on a
    // row the payment worker has not reached yet, say. Deriving from a
    // partial picture would announce a stage the order has not reached.
    const derived = leastAdvancedFulfilmentStatus(shops.map((shop) => shop.status));
    if (!derived) continue;
    if (derived === order.status) continue;

    await tx.order.update({ where: { id: orderId }, data: { status: derived } });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: derived,
        note: history?.note ?? (shops.length > 1
          ? 'Derived from every shop in this order'
          : 'Follows the shop handling this order'),
        createdBy: history?.createdBy,
      },
    });
  }
}
