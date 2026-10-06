import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { WebhooksController } from './webhooks.controller';
import { EconomicWebhookRetryException } from './economic-webhook-retry.exception';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EconomicPaymentsService } from './economic-payments.service';

describe('versioned payments never fall back to legacy bookkeeping', () => {
  function fixture() {
    const economicPayments = { hasContext: jest.fn().mockResolvedValue({ id: 'context' }), createStripe: jest.fn().mockResolvedValue({ clientSecret: 'synthetic' }),
      createPaypal: jest.fn().mockResolvedValue({ paypalOrderId: 'fixture' }), stripeWebhook: jest.fn().mockResolvedValue(true),
      paypalWebhook: jest.fn().mockResolvedValue(true), capturePaypal: jest.fn().mockResolvedValue(undefined) };
    const prisma = { order: { findUnique: jest.fn() }, payment: { findFirst: jest.fn(), findUnique: jest.fn() } };
    const redis = { getClient: jest.fn() }, eventBus = { publish: jest.fn() };
    const service = { economicPayments, prisma, redis, eventBus } as unknown as PaymentsService;
    return { economicPayments, prisma, redis, eventBus, service };
  }
  it('routes Stripe creation through the persisted quote before legacy/gift-card work', async () => {
    const h = fixture();
    await PaymentsService.prototype.createPaymentIntentForOrder.call(h.service, 'order', 'gift');
    expect(h.economicPayments.createStripe).toHaveBeenCalledWith('order', 'gift');
    expect(h.prisma.order.findUnique).not.toHaveBeenCalled();
  });
  it('uses durable capture handling for Stripe duplicates without Redis TTL or legacy paid events', async () => {
    const h = fixture(); const event = { type: 'payment_intent.succeeded', data: { object: { id: 'pi_fixture' } } };
    await PaymentsService.prototype.handleStripeWebhook.call(h.service, event);
    await PaymentsService.prototype.handleStripeWebhook.call(h.service, event);
    expect(h.economicPayments.stripeWebhook).toHaveBeenCalledTimes(2);
    expect(h.redis.getClient).not.toHaveBeenCalled(); expect(h.eventBus.publish).not.toHaveBeenCalled();
  });
  it('uses the same capture path for PayPal and makes verification failures retriable without leaking provider details', async () => {
    const h = fixture();
    await PaymentsService.prototype.handlePaypalWebhookEvent.call(h.service, 'PAYMENT.CAPTURE.COMPLETED', {}, 'event');
    expect(h.prisma.payment.findFirst).not.toHaveBeenCalled(); expect(h.eventBus.publish).not.toHaveBeenCalled();
    h.economicPayments.paypalWebhook.mockRejectedValue(new Error('secret-provider-token'));
    await expect(PaymentsService.prototype.handlePaypalWebhookEvent.call(h.service, 'PAYMENT.CAPTURE.COMPLETED', {}, 'event')).rejects.toThrow(EconomicWebhookRetryException);
    try { await PaymentsService.prototype.handlePaypalWebhookEvent.call(h.service, 'PAYMENT.CAPTURE.COMPLETED', {}, 'event'); }
    catch (error) { expect(String(error)).not.toContain('secret-provider-token'); }
  });
  it('blocks legacy refund and gift-card mutations on a versioned order', async () => {
    const h = fixture(); h.prisma.payment.findUnique.mockResolvedValue({ orderId: 'order', order: { id: 'order' } });
    await expect(PaymentsService.prototype.createRefund.call(h.service, 'payment', {})).rejects.toThrow('legacy refund is disabled');
    await expect(PaymentsService.prototype.applyGiftCard.call(h.service, 'gift', 'order')).rejects.toThrow('not supported');
    expect(h.prisma.order.findUnique).not.toHaveBeenCalled();
  });
  it('does not swallow a versioned PayPal processing failure into HTTP success', async () => {
    const payments = { handlePaypalWebhookEvent: jest.fn().mockRejectedValue(new EconomicWebhookRetryException()) };
    const paypal = { verifyWebhookSignature: jest.fn().mockResolvedValue(true) };
    const controller = new WebhooksController(payments as unknown as PaymentsService, paypal as unknown as PaypalService);
    await expect(controller.paypalWebhook({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAPTURE' }, id: 'EVENT' },
      {} as Request, {})).rejects.toMatchObject({ status: 503 });
    paypal.verifyWebhookSignature.mockResolvedValue(false);
    payments.handlePaypalWebhookEvent.mockClear();
    await controller.paypalWebhook({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {}, id: 'EVENT' }, {} as Request, {});
    expect(payments.handlePaypalWebhookEvent).not.toHaveBeenCalled();
  });
  it.each([
    { id: 'CAPTURE', custom_id: 'capture-operation', supplementary_data: { related_ids: { order_id: 'PPORDER' } } },
    { id: 'PPORDER', purchase_units: [{ custom_id: 'capture-operation' }] },
  ])('keeps an early PayPal webhook retriable when external creation outruns local binding: %p', async object => {
    const prisma = { payment: { findFirst: jest.fn().mockResolvedValue(null) },
      economicOperation: { findFirst: jest.fn().mockResolvedValue({ id: 'capture-operation' }) } };
    const service = new EconomicPaymentsService(prisma as unknown as PrismaService, new ConfigService());
    await expect(service.paypalWebhook('PAYMENT.CAPTURE.COMPLETED', object)).rejects.toThrow('reconciliation required');
    expect(prisma.economicOperation.findFirst).toHaveBeenCalledWith({ where: {
      id: { in: ['capture-operation'] }, provider: 'PAYPAL', kind: 'CAPTURE',
    } });
    prisma.economicOperation.findFirst.mockResolvedValue(null);
    expect(await service.paypalWebhook('PAYMENT.CAPTURE.COMPLETED', object)).toBe(false);
  });
});
