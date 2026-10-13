import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrderPayerService } from './order-payer.service';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';

function fixture(balance = 20) {
  const order = {
    id: 'order',
    orderNumber: 'SYNTHETIC',
    userId: null,
    isDigital: false,
    total: 100,
    status: OrderStatus.PENDING_PAYMENT,
    adminArchivedAt: null,
  };
  const card = {
    id: 'card',
    code: 'SYNTHETIC-NOT-REAL',
    isActive: true,
    balance,
    expiresAt: null as Date | null,
  };
  const payment = {
    id: 'payment',
    orderId: order.id,
    order,
    status: PaymentStatus.PENDING as PaymentStatus,
    stripePaymentIntentId: 'synthetic-intent',
    providerEventId: null as string | null,
    giftCardCode: card.code,
    giftCardAmount: 20,
  };
  const prisma = {
    $queryRaw: jest.fn(),
    order: {
      findUnique: jest.fn(async () => order),
      findUniqueOrThrow: jest.fn(async () => order),
      update: jest.fn(),
    },
    giftCard: {
      findFirst: jest.fn(async () => card),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => ({ id: card.id })),
    },
    giftCardUsage: { count: jest.fn(async () => 0), create: jest.fn() },
    payment: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => payment),
      findUniqueOrThrow: jest.fn(async () => payment),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    orderStatusHistory: { create: jest.fn() },
    cart: { updateMany: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    orderEventOutbox: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (work) => work(prisma));
  const stripe = {
    paymentIntents: {
      create: jest.fn(async () => ({
        id: 'synthetic-intent',
        client_secret: 'synthetic-not-real',
      })),
    },
  };
  const orderOutbox = { kick: jest.fn() };
  const client = { set: jest.fn(async () => 'OK'), del: jest.fn() };
  const economicPayments = {
    hasContext: jest.fn(async () => null),
    stripeWebhook: jest.fn(async () => false),
    paypalWebhook: jest.fn(async () => false),
  };
  const service: PaymentsService = Object.assign(
    Object.create(PaymentsService.prototype),
    {
      prisma,
      stripe,
      orderOutbox,
      economicPayments,
      redis: { getClient: () => client },
      logger: { log: jest.fn(), warn: jest.fn() },
    },
  );
  return { order, card, payment, prisma, stripe, orderOutbox, service, client };
}

describe('legacy gift-card P1 regression', () => {
  it('quotes partial coverage without spending funds, then creates the correct split intent', async () => {
    const h = fixture();
    expect(await h.service.applyGiftCard(h.card.code, h.order.id)).toEqual({
      appliedAmount: 20,
      remainingOrderTotal: 80,
      fullyPaid: false,
    });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.prisma.giftCardUsage.create).not.toHaveBeenCalled();
    expect(h.card.balance).toBe(20);
    expect(
      await h.service.createPaymentIntentForOrder(h.order.id, h.card.code),
    ).toMatchObject({ amount: 80 });
    expect(h.stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8000 }),
    );
    expect(h.prisma.giftCard.updateMany).not.toHaveBeenCalled();
    expect(h.prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ giftCardAmount: 20 }),
      }),
    );
  });
  it.each(['apply', 'intent'] as const)(
    'rejects an expired card through %s without spending or charging',
    async (action) => {
      const h = fixture();
      h.card.expiresAt = new Date(0);
      const work =
        action === 'apply'
          ? h.service.applyGiftCard(h.card.code, 'order')
          : h.service.createPaymentIntentForOrder('order', h.card.code);
      await expect(work).rejects.toThrow('expired');
      expect(h.prisma.giftCard.updateMany).not.toHaveBeenCalled();
      expect(h.stripe.paymentIntents.create).not.toHaveBeenCalled();
    },
  );
  it.each(['apply', 'intent'] as const)(
    'blocks old unbooked debits through %s instead of charging again',
    async (action) => {
      const h = fixture();
      h.prisma.giftCardUsage.count.mockResolvedValueOnce(1);
      await expect(
        action === 'apply'
          ? h.service.applyGiftCard(h.card.code, 'order')
          : h.service.createPaymentIntentForOrder('order'),
      ).rejects.toThrow('reconciliation');
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
      expect(h.stripe.paymentIntents.create).not.toHaveBeenCalled();
    },
  );
  it('does not forgive an uncovered amount below the Stripe minimum', async () => {
    const h = fixture(99.75);
    await expect(
      h.service.createPaymentIntentForOrder('order', h.card.code),
    ).rejects.toThrow('at least $0.50');
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
    expect(h.prisma.giftCard.updateMany).not.toHaveBeenCalled();
  });
  it('uses cents so a valid 50-cent remainder is not rejected by floating point', async () => {
    const h = fixture(199.45);
    h.order.total = 199.95;
    expect(
      await h.service.createPaymentIntentForOrder('order', h.card.code),
    ).toMatchObject({ amount: 0.5 });
    expect(h.stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    );
  });
  it('deducts only at verified capture and atomically records its queue intent', async () => {
    const h = fixture();
    await h.service.handleStripeWebhook({
      id: 'evt',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'synthetic-intent' } },
    });
    expect(h.prisma.giftCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.any(Array),
        }),
        data: { balance: { decrement: 20 } },
      }),
    );
    expect(h.prisma.orderEventOutbox.createMany).toHaveBeenCalledWith({
      data: [{ eventType: 'ORDER_PAID', orderId: 'order' }],
      skipDuplicates: true,
    });
    expect(h.orderOutbox.kick).toHaveBeenCalledTimes(1);
  });
  it('duplicate PAID callback retries handoff without repeating money/status mutations', async () => {
    const h = fixture();
    h.payment.status = PaymentStatus.PAID;
    await h.service.handleStripeWebhook({
      id: 'retry',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'synthetic-intent' } },
    });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.orderOutbox.kick).toHaveBeenCalledTimes(1);
  });
  it('rejects a changed intent binding before debiting a different gift-card split', async () => {
    const h = fixture();
    h.prisma.payment.findUniqueOrThrow.mockResolvedValueOnce({
      ...h.payment,
      stripePaymentIntentId: 'replacement-intent',
    });
    await expect(
      h.service.handleStripeWebhook({
        id: 'evt',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'synthetic-intent' } },
      }),
    ).rejects.toThrow('binding changed');
    expect(h.prisma.giftCard.updateMany).not.toHaveBeenCalled();
    expect(h.prisma.payment.update).not.toHaveBeenCalled();
    expect(h.client.del).toHaveBeenCalled();
  });
  it('records PayPal capture and queue intent in the same locked transaction', async () => {
    const h = fixture();
    await h.service.handlePaypalWebhookEvent(
      'PAYMENT.CAPTURE.COMPLETED',
      {
        id: 'capture',
        supplementary_data: { related_ids: { order_id: 'paypal-order' } },
      },
      '',
    );
    expect(h.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PAID',
          paypalCaptureId: 'capture',
        }),
      }),
    );
    expect(h.prisma.orderEventOutbox.createMany).toHaveBeenCalledWith({
      data: [{ eventType: 'ORDER_PAID', orderId: 'order' }],
      skipDuplicates: true,
    });
    expect(h.orderOutbox.kick).toHaveBeenCalledTimes(1);
  });
  it('does not repeat a PayPal state transition after a concurrent capture', async () => {
    const h = fixture();
    h.prisma.payment.findUniqueOrThrow.mockResolvedValueOnce({
      ...h.payment,
      status: PaymentStatus.PAID,
    });
    await h.service.handlePaypalWebhookEvent(
      'PAYMENT.CAPTURE.COMPLETED',
      {
        id: 'capture',
        supplementary_data: { related_ids: { order_id: 'paypal-order' } },
      },
      '',
    );
    expect(h.prisma.payment.update).not.toHaveBeenCalled();
    expect(h.prisma.orderEventOutbox.createMany).not.toHaveBeenCalled();
    expect(h.orderOutbox.kick).toHaveBeenCalledTimes(1);
  });
  it('serializes gift-card-only completion and records payment plus outbox', async () => {
    const h = fixture(100);
    expect(await h.service.applyGiftCard(h.card.code, 'order')).toMatchObject({
      fullyPaid: true,
    });
    expect(h.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID', giftCardAmount: 100 }),
      }),
    );
    expect(h.prisma.orderEventOutbox.createMany).toHaveBeenCalledTimes(1);
  });
  it('fails completion if the gift card is revoked or exhausted before the atomic debit', async () => {
    const h = fixture(100);
    h.prisma.giftCard.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(h.service.applyGiftCard(h.card.code, 'order')).rejects.toThrow(
      'insufficient',
    );
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
    expect(h.prisma.orderEventOutbox.createMany).not.toHaveBeenCalled();
  });
});

describe('gift-card apply authorization', () => {
  it('requires OptionalAuthGuard and denies an account-owned order to a stranger or guest', async () => {
    expect(
      new Reflector().get(
        GUARDS_METADATA,
        PaymentsController.prototype.applyGiftCard,
      ),
    ).toContain(OptionalAuthGuard);
    const payer = new OrderPayerService({
      order: {
        findUnique: jest.fn(async () => ({ id: 'order', userId: 'owner' })),
      },
    } as never);
    const payments = { applyGiftCard: jest.fn() };
    const controller = new PaymentsController(
      payments as never,
      {} as never,
      {} as never,
      payer,
    );
    await expect(
      controller.applyGiftCard('synthetic', { orderId: 'order' }),
    ).rejects.toThrow('another account');
    await expect(
      controller.applyGiftCard('synthetic', { orderId: 'order' }, {
        sub: 'stranger',
      } as never),
    ).rejects.toThrow('another account');
    expect(payments.applyGiftCard).not.toHaveBeenCalled();
    await controller.applyGiftCard('synthetic', { orderId: 'order' }, {
      sub: 'owner',
    } as never);
    expect(payments.applyGiftCard).toHaveBeenCalledWith('synthetic', 'order');
  });
  it('preserves the existing opaque-ID payer rule for a genuinely guest-owned order', async () => {
    const payer = new OrderPayerService({
      order: {
        findUnique: jest.fn(async () => ({ id: 'order', userId: null })),
      },
    } as never);
    const payments = { applyGiftCard: jest.fn() };
    await new PaymentsController(
      payments as never,
      {} as never,
      {} as never,
      payer,
    ).applyGiftCard('synthetic', { orderId: 'order' });
    expect(payments.applyGiftCard).toHaveBeenCalledTimes(1);
  });
});
