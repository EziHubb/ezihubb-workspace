import { EconomicOutbox, EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';
import { consumeEconomicEvent } from './economic-durability';
import { externalEffectHash } from './economic-external-effect';
import { minorDecimal } from './economic-balance';

/** Independent DB-only consumer after original lifecycle proof. Notification,
 * receipt and email intent commit together; external SMTP never runs here.
 * TEST remains visible only in scoped admin readers, never buyer notifications. */
export async function consumeEconomicNotifications(db: Pick<PrismaClient, '$transaction' | 'economicOperation' | 'economicOutbox'>,
  event: EconomicOutbox, provenance: EconomicProvenance, smtpAccount: string) {
  if (!['capture.verified.v1','refund.verified.v1'].includes(event.eventType)) throw new Error('Unsupported notification event');
  return consumeEconomicEvent(db, event.id, 'notifications.v1',
    { provenance, eventType: event.eventType as 'capture.verified.v1' | 'refund.verified.v1' }, async (tx, current) => {
      const original = await tx.economicConsumerReceipt.findUnique({ where: { eventId_consumer: { eventId: current.id, consumer: 'lifecycle.v1' } } });
      if (!original) throw new Error('Notification requires original lifecycle receipt');
      const context = await tx.economicOrderContext.findUniqueOrThrow({ where: { id: current.contextId } });
      if (context.provenance !== provenance || context.currency !== 'USD') throw new Error('Notification scope mismatch');
      const operationId = (current.payload as { operationId?: unknown }).operationId;
      if (typeof operationId !== 'string') throw new Error('Missing notification operation');
      let amount: bigint;
      if (current.eventType === 'capture.verified.v1') {
        const capture = await tx.economicCapture.findUniqueOrThrow({ where: { contextId: context.id } });
        if (capture.operationId !== operationId) throw new Error('Notification capture mismatch');
        amount = capture.amountMinor;
      } else {
        const request = await tx.economicRefundRequest.findUniqueOrThrow({ where: { operationId }, include: { settlement: true, capture: true } });
        if (!request.settlement || request.capture.contextId !== context.id) throw new Error('Notification refund proof missing');
        amount = request.settlement.amountMinor;
      }
      if (provenance === 'TEST') return; // Do not contact real buyers for TEST evidence.
      const order = await tx.order.findUniqueOrThrow({ where: { id: context.orderId }, include: { user: true } });
      const refund = current.eventType === 'refund.verified.v1';
      const title = refund ? 'Refund verified' : 'Payment verified';
      const body = `Order ${order.orderNumber}: ${refund ? 'refund' : 'payment'} of USD ${minorDecimal(amount, 2)} verified. View your order for current status.`;
      if (order.userId && order.user?.pushEnabled) {
        const existing = await tx.economicNotificationReceipt.findUnique({ where: { eventId_recipientId: { eventId: current.id, recipientId: order.userId } } });
        if (!existing) {
          const notification = await tx.notification.create({ data: { userId: order.userId,
            type: refund ? 'ORDER_REFUND_VERIFIED' : 'ORDER_CAPTURE_VERIFIED', title, body,
            data: { version: 'economic-v1', eventId: current.id, orderId: order.id, provenance } } });
          await tx.economicNotificationReceipt.create({ data: { eventId: current.id, recipientId: order.userId, notificationId: notification.id } });
        }
      }
      const email = order.user?.email ?? order.guestEmail;
      if (!email || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return;
      const payload = { version: 'notification-v1', to: email, subject: `${title}: ${order.orderNumber}`, text: body };
      await tx.economicExternalEffect.createMany({ data: [{ contextId: context.id, sourceEventId: current.id,
        effectKey: externalEffectHash({ kind: 'EMAIL_TRANSACTIONAL', eventId: current.id, to: email }), kind: 'EMAIL_TRANSACTIONAL',
        providerAccount: smtpAccount, payload: payload as Prisma.InputJsonValue, payloadHash: externalEffectHash(payload),
        requestedBy: 'system:lifecycle', reason: 'Original verified lifecycle notification' }], skipDuplicates: true });
    });
}
