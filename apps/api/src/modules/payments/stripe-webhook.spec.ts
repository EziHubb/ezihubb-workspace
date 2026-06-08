import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { QUEUES } from '../../queue/queue.constants';

// Stripe is initialised with the key from ConfigService — stub it out
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: { create: jest.fn() },
    refunds:        { create: jest.fn() },
    webhooks:       { constructEvent: jest.fn() },
  }));
});

const NOW = new Date('2026-01-15T12:00:00Z');

const mockOrder = {
  id:            'order-001',
  orderNumber:   'MLH-2026-00001',
  userId:        'user-001',
  guestEmail:    null,
  status:        OrderStatus.PENDING_PAYMENT,
  total:         59.98,
  confirmedAt:   null,
  isGift:        false,
  giftMessage:   null,
  giftFrom:      null,
  giftReceipt:   false,
  giftWrapping:  false,
};

const mockPayment = {
  id:                    'pay-001',
  orderId:               'order-001',
  method:                PaymentMethod.STRIPE,
  status:                PaymentStatus.PENDING,
  amount:                59.98,
  currency:              'usd',
  stripePaymentIntentId: 'pi_test_001',
  stripeChargeId:        null,
  giftCardCode:          null,
  giftCardAmount:        null,
  refundedAmount:        0,
  refundedAt:            null,
  refundReason:          null,
  paidAt:                null,
  createdAt:             new Date(),
  order:                 mockOrder,
};

describe('PaymentsService — Stripe webhook handler', () => {
  let service: PaymentsService;
  let prisma:  DeepMockProxy<PrismaService>;
  let redis:   DeepMockProxy<RedisService>;
  let emailQueue: { add: jest.Mock };
  let orderQueue: { add: jest.Mock };

  beforeEach(async () => {
    emailQueue = { add: jest.fn().mockResolvedValue({ id: '1' }) };
    orderQueue = { add: jest.fn().mockResolvedValue({ id: '2' }) };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService,    useValue: mockDeep<PrismaService>() },
        { provide: RedisService,     useValue: mockDeep<RedisService>() },
        { provide: AnalyticsService, useValue: { trackEvent: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY')      return 'sk_test_fake';
              if (key === 'STRIPE_WEBHOOK_SECRET')  return '';
              return '';
            }),
          },
        },
        { provide: getQueueToken(QUEUES.EMAIL),           useValue: emailQueue },
        { provide: getQueueToken(QUEUES.ORDER_PROCESSING), useValue: orderQueue },
      ],
    }).compile();

    service = module.get(PaymentsService);
    prisma  = module.get(PrismaService);
    redis   = module.get(RedisService);

    // Default: idempotency check passes (first time seeing this event)
    const mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),  // 'OK' = acquired the lock
      del: jest.fn().mockResolvedValue(1),
    };
    redis.getClient.mockReturnValue(mockRedisClient as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── payment_intent.succeeded ─────────────────────────────────────────────

  describe('handleStripeWebhook — payment_intent.succeeded', () => {
    const successEvent = {
      id:   'evt_test_succeeded_001',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id:             'pi_test_001',
          status:         'succeeded',
          latest_charge:  'ch_test_001',
          metadata:       { orderId: 'order-001' },
          amount_received: 5998,
        },
      },
    };

    beforeEach(() => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment as any);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.PAID } as any);
      prisma.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.cart.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 } as any);
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder, total: 59.98 } as any);
      // getUserEmail helper
      prisma.user.findUnique.mockResolvedValue({ email: 'customer@example.com' } as any);
    });

    it('updates payment to PAID and order to CONFIRMED', async () => {
      await service.handleStripeWebhook(successEvent);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.PAID }),
        }),
      );
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
        }),
      );
    });

    it('queues order-confirmed email notification', async () => {
      await service.handleStripeWebhook(successEvent);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({ template: 'order-confirmed' }),
        expect.any(Object),
      );
    });

    it('queues order processing job', async () => {
      await service.handleStripeWebhook(successEvent);

      expect(orderQueue.add).toHaveBeenCalled();
    });

    it('is idempotent — skips already-processed events (NX lock not acquired)', async () => {
      const mockRedisClient = { set: jest.fn().mockResolvedValue(null) }; // null = already locked
      redis.getClient.mockReturnValue(mockRedisClient as any);

      await service.handleStripeWebhook(successEvent);

      // Nothing should be processed
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('handles no payment record gracefully (logs and returns)', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.handleStripeWebhook(successEvent)).resolves.not.toThrow();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('does not re-process an already PAID payment', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      } as any);

      await service.handleStripeWebhook(successEvent);

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('releases idempotency lock and rethrows on processing error', async () => {
      const mockRedisClient = {
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      };
      redis.getClient.mockReturnValue(mockRedisClient as any);
      prisma.$transaction.mockRejectedValue(new Error('DB failure'));

      await expect(service.handleStripeWebhook(successEvent)).rejects.toThrow('DB failure');
      expect(mockRedisClient.del).toHaveBeenCalledWith(`stripe:webhook:${successEvent.id}`);
    });
  });

  // ─── payment_intent.payment_failed ────────────────────────────────────────

  describe('handleStripeWebhook — payment_intent.payment_failed', () => {
    const failedEvent = {
      id:   'evt_test_failed_001',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id:     'pi_test_002',
          status: 'requires_payment_method',
        },
      },
    };

    it('updates payment status to FAILED', async () => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment as any);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED } as any);

      await service.handleStripeWebhook(failedEvent);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
    });
  });

  // ─── createPaymentIntent ───────────────────────────────────────────────────

  describe('createPaymentIntentForOrder', () => {
    it('throws NotFoundException for unknown orderId', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createPaymentIntentForOrder('bad-order-id'),
      ).rejects.toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'ERR_NOT_FOUND' }) }));
    });

    it('throws ERR_ORDER_INVALID_STATE for already-confirmed order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      } as any);

      await expect(
        service.createPaymentIntentForOrder('order-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
