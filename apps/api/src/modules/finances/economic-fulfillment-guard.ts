import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ECONOMIC_POLICY_VERSION } from './economic-policy';

/** Call in the same Serializable DB-only transaction as a manual transition.
 * Legacy orders retain their existing behavior. A display status or paid flag
 * alone never authorizes fulfillment of a versioned checkout. */
export async function assertEconomicFulfillmentAllowed(tx: Prisma.TransactionClient, orderId: string) {
  const context = await tx.economicOrderContext.findUnique({ where: { orderId } });
  if (!context) return false;
  const reject: () => never = () => { throw new ConflictException('Versioned fulfillment requires verified payment, captured inventory and resolved reconciliation'); };
  if (context.policyVersion !== ECONOMIC_POLICY_VERSION || context.currency !== 'USD' || context.minorExponent !== 2) reject();
  await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${context.id} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
  if (order.adminArchivedAt || ['PENDING_PAYMENT','CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'].includes(order.status)
    || order.payment?.status !== 'PAID') reject();
  const capture = await tx.economicCapture.findUnique({ where: { contextId: context.id } });
  if (!capture || capture.provenance !== context.provenance || capture.currency !== context.currency || capture.quoteHash !== context.quoteHash) reject();
  const originalCapture = capture;
  const lifecycle = await tx.economicOutbox.findFirst({ where: {
    contextId: context.id, eventType: 'capture.verified.v1',
    payload: { path: ['operationId'], equals: originalCapture.operationId },
    receipts: { some: { consumer: 'lifecycle.v1' } },
  }, select: { id: true } });
  if (!lifecycle) reject();
  const reservations = await tx.economicInventoryReservation.findMany({ where: { contextId: context.id }, include: { reacquisition: true } });
  if (!reservations.length || reservations.some(row => row.state !== 'CONSUMED'
    && (!['EXPIRED','RELEASED'].includes(row.state) || row.reacquisition?.captureId !== originalCapture.id
      || row.reacquisition.quantity !== row.quantity))) reject();
  const pendingRefund = await tx.economicOperation.count({ where: { contextId: context.id, kind: 'REFUND', state: { notIn: ['SUCCEEDED','FAILED'] } } });
  const held = await tx.economicBalanceLot.count({ where: { captureId: originalCapture.id,
    OR: [{ holdReason: { not: null } }, { account: { holdReason: { not: null } } }] } });
  if (pendingRefund || held) reject();
  return true;
}

/** The parent may still be active in a multi-shop order with a closed shop. */
export async function assertEconomicShopFulfillmentAllowed(tx: Prisma.TransactionClient, orderId: string, storeOrderIds: string[]) {
  const versioned = await assertEconomicFulfillmentAllowed(tx, orderId);
  if (versioned) {
    const rows = await tx.storeOrder.findMany({ where: { orderId, id: { in: storeOrderIds } }, select: { id: true, status: true } });
    if (!storeOrderIds.length || rows.length !== new Set(storeOrderIds).size || rows.some(row => ['PENDING_PAYMENT','CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'].includes(row.status))) {
      throw new ConflictException('Closed or unpaid shop orders cannot re-enter versioned fulfillment');
    }
  }
  return versioned;
}
