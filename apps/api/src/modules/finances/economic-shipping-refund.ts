import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EconomicQuote } from './economic-quote';
import { RefundSelection, SHIPPING_REFUND_POLICY, ShippingRefundEligibility } from './economic-refund-plan';

/** Conservative pre-handoff proof. A cancelled display status alone is not
 * sufficient: timestamps, tracking and any POD attempt also block this rule.
 * Unknown provider outcomes are not proof that an order was never handed off. */
export async function shippingRefundEligible(tx: Prisma.TransactionClient, quote: EconomicQuote, storeOrderId: string) {
  const original = quote.stores.find(shop => shop.storeOrderId === storeOrderId);
  if (!original) return false;
  const shop = await tx.storeOrder.findUnique({ where: { id: storeOrderId }, include: { fulfillments: true } });
  if (!shop || shop.orderId !== quote.orderId || shop.storeId !== original.storeId || shop.status !== 'CANCELLED'
    || shop.shippedAt || shop.deliveredAt || shop.trackingNumber || shop.trackingUrl || shop.carrier
    || shop.fulfillments.length) return false;
  // A frozen versioned POD intent is also a handoff risk. Never infer that an
  // unknown POST failed simply because the legacy fulfillment table is empty.
  const podIntents = await tx.economicExternalEffect.count({ where: { storeOrderId, kind: 'POD_PRINTIFY',
    context: { orderId: quote.orderId } } });
  if (podIntents) return false;
  // Parent shipment/history cannot prove which shop was handed off: hold rather
  // than guess in multi-shop orders with incomplete historical shop evidence.
  const order = await tx.order.findUniqueOrThrow({ where: { id: quote.orderId }, select: { shippedAt: true, deliveredAt: true } });
  const handoffs = await tx.orderStatusHistory.count({ where: { orderId: quote.orderId,
    status: { in: ['SHIPPED', 'DELIVERED', 'COMPLETED'] } } });
  return !order.shippedAt && !order.deliveredAt && handoffs === 0;
}

/** Called under the original capture lock; serialize with fulfillment's
 * context/order locks before inspecting shop handoff evidence. */
export async function verifiedShippingRefundEligibility(tx: Prisma.TransactionClient, contextId: string,
  quote: EconomicQuote, selection: RefundSelection[], previous: ReadonlyMap<string, number>): Promise<ShippingRefundEligibility | undefined> {
  const ids = [...new Set(selection.map(row => quote.parts.find(part => part.key === row.partKey))
    .filter((part): part is EconomicQuote['parts'][number] => part?.kind === 'SHIPPING').map(part => part.storeOrderId))].sort();
  if (!ids.length) return undefined;
  await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${contextId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${quote.orderId} FOR UPDATE`;
  for (const id of ids) {
    await tx.$queryRaw`SELECT "id" FROM "StoreOrder" WHERE "id" = ${id} FOR UPDATE`;
    if (!await shippingRefundEligible(tx, quote, id)) {
      throw new ConflictException('Shipping refund requires a fully cancelled shop with no handoff or POD attempt');
    }
  }
  return { policy: SHIPPING_REFUND_POLICY, storeOrderIds: ids, previousItemQuantities: Object.fromEntries(
    quote.parts.filter(part => part.kind === 'ITEM' && ids.includes(part.storeOrderId)).map(part => [part.key, previous.get(part.key) ?? 0])) };
}
