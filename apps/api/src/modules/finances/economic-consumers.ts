import { EconomicOutbox, EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';
import { consumeCapturedInventory } from '../products/inventory-reservation';
import { consumeEconomicEvent } from './economic-durability';
import { ECONOMIC_POLICY_VERSION } from './economic-policy';

type Database = Pick<PrismaClient, '$transaction' | 'economicOperation' | 'economicOutbox'>;

/** DB-only versioned lifecycle. Never publishes legacy paid jobs, credits the
 * legacy ledger, sends mail or calls a POD provider inside this transaction. */
export async function consumeVerifiedEconomics(db: Database, event: EconomicOutbox, provenance: EconomicProvenance) {
  if (!['capture.verified.v1','refund.verified.v1'].includes(event.eventType)) throw new Error('Unsupported economic event');
  return consumeEconomicEvent(db,event.id,'lifecycle.v1',{ provenance, eventType:event.eventType as 'capture.verified.v1'|'refund.verified.v1' },
    (tx,current)=>applyVerifiedEconomicLifecycle(tx,current,provenance));
}

/** Shared by delivery and audited DEAD recovery, always inside one DB-only
 * transaction with the lifecycle receipt. No legacy queues or provider I/O. */
export async function applyVerifiedEconomicLifecycle(tx: Prisma.TransactionClient, current: EconomicOutbox, provenance: EconomicProvenance) {
    const payload=current.payload as {operationId?:unknown};
    if (typeof payload.operationId !== 'string') throw new Error('Missing economic operation reference');
    const context=await tx.economicOrderContext.findUniqueOrThrow({where:{id:current.contextId}});
    if (context.policyVersion!==ECONOMIC_POLICY_VERSION || context.provenance!==provenance
      || !['capture.verified.v1','refund.verified.v1'].includes(current.eventType)) throw new Error('Unsupported lifecycle evidence scope');
    await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${context.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${context.orderId} FOR UPDATE`;
    const order=await tx.order.findUniqueOrThrow({where:{id:context.orderId},include:{payment:true,storeOrders:true}});
    if (current.eventType === 'capture.verified.v1') {
      if (order.adminArchivedAt || ['CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'].includes(order.status)
        || order.storeOrders.some(shop => ['CANCELLED','REFUND_REQUESTED','REFUNDED','DISPUTED'].includes(shop.status))) {
        throw new Error('Closed order requires reconciliation before capture consumption');
      }
      const capture=await tx.economicCapture.findUniqueOrThrow({where:{contextId:context.id}});
      if (capture.operationId!==payload.operationId || capture.provenance!==provenance || order.payment?.status!=='PAID') throw new Error('Capture proof/payment mismatch');
      await consumeCapturedInventory(tx,capture.id);
      if (order.status==='PENDING_PAYMENT') {
        const confirmed=await tx.order.updateMany({where:{id:order.id,status:'PENDING_PAYMENT',adminArchivedAt:null},data:{status:'CONFIRMED',confirmedAt:new Date()}});
        if (confirmed.count!==1) throw new Error('Order changed during capture consumption');
        await tx.orderStatusHistory.create({data:{orderId:order.id,status:'CONFIRMED',note:'Verified payment and captured inventory (economic-v1)'}});
      }
      await tx.storeOrder.updateMany({where:{orderId:order.id,status:'PENDING_PAYMENT'},data:{status:'CONFIRMED'}});
      // Seller work queue is the durable manual fulfillment boundary. External
      // POD dispatch is deliberately NOT delegated to the unsafe legacy retry.
      return;
    }
    const request=await tx.economicRefundRequest.findUniqueOrThrow({where:{operationId:payload.operationId},include:{settlement:true,capture:true}});
    if (!request.settlement || request.capture.contextId!==context.id || request.capture.provenance!==provenance) throw new Error('Refund event has no settlement proof');
    const completed=await tx.economicRefund.findMany({where:{request:{captureId:request.captureId}},select:{amountMinor:true}});
    const total=completed.reduce((sum,row)=>sum+row.amountMinor,0n);
    if (total>request.capture.amountMinor) throw new Error('Refund exceeds original collected amount');
    if (total===request.capture.amountMinor) {
      await tx.payment.updateMany({where:{orderId:order.id,status:'PAID'},data:{status:'REFUNDED'}});
      await tx.storeOrder.updateMany({where:{orderId:order.id,status:{not:'REFUNDED'}},data:{status:'REFUNDED'}});
      const closed=await tx.order.updateMany({where:{id:order.id,status:{not:'REFUNDED'}},data:{status:'REFUNDED'}});
      if (closed.count) await tx.orderStatusHistory.create({data:{orderId:order.id,status:'REFUNDED',note:'Full original payment refund verified (economic-v1)'}});
    }
    // Partial refund preserves fulfillment progress. Refund is not returned-stock proof.
}
